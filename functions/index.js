'use strict';

// Operaciones privilegiadas: NO mover a React ni copiar credenciales privadas al cliente.
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const region = 'southamerica-east1';

function requireString(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpsError('invalid-argument', `${label}: introduce un valor válido.`);
  }
  return value.trim();
}
function passwordValid(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 128 ||
      !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener de 6 a 128 caracteres.');
  }
  return password;
}
function emailValid(raw) {
  const email = requireString(raw, 'Correo', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Correo electrónico no válido.');
  }
  return email;
}
async function contextFor(request, stationId) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const callerUid = request.auth.uid;
  const [profileSnap, stationSnap] = await Promise.all([
    db.doc(`users/${callerUid}`).get(), db.doc(`stations/${stationId}`).get()
  ]);
  if (!profileSnap.exists || !stationSnap.exists) throw new HttpsError('permission-denied', 'Acceso no autorizado.');
  const profile = profileSnap.data();
  if (profile.active !== true || !['owner','admin'].includes(profile.role))
    throw new HttpsError('permission-denied', 'Tu cuenta no puede gestionar personal.');
  if (profile.role === 'admin' && profile.stationId !== stationId)
    throw new HttpsError('permission-denied', 'No tienes permiso para esta estación.');
  if (stationSnap.data().active !== true) throw new HttpsError('failed-precondition','El establecimiento está inactivo.');
  return {uid: callerUid, profile, station: stationSnap.data(), stationRef:stationSnap.ref};
}
function authorizedTarget(ctx, target, operation) {
  if (!target || !['admin','operator'].includes(target.role) || target.stationId !== ctx.stationRef.id)
    throw new HttpsError('permission-denied','El usuario no pertenece a esta estación.');
  if (ctx.profile.role === 'admin' && target.role !== 'operator')
    throw new HttpsError('permission-denied', 'Solo el propietario puede gestionar administradores.');
  if (operation === 'activate' && target.role === 'admin' && ctx.profile.role !== 'owner')
    throw new HttpsError('permission-denied', 'Solo el propietario puede reactivar administradores.');
}
async function audit(ctx, type, targetUid, metadata = {}) {
  await ctx.stationRef.collection('accessAudit').add({
    action: type, targetUid, performedBy: ctx.uid, metadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
async function activeAdmins(stationId) {
  const snap = await db.collection('users').where('stationId','==',stationId).get();
  return snap.docs.filter(d => d.data().role === 'admin' && d.data().active === true);
}

exports.manageStaff = onCall({region, maxInstances: 5, memory: '256MiB', timeoutSeconds: 30}, async request => {
  const input = request.data || {};
  const action = requireString(input.action, 'Acción', 30);
  const stationId = requireString(input.stationId, 'Establecimiento', 100);
  const ctx = await contextFor(request, stationId);

  if (action === 'create') {
    const role = requireString(input.role,'Rol',20);
    if (!['admin','operator'].includes(role)) throw new HttpsError('invalid-argument','Rol inválido.');
    if (role === 'admin' && ctx.profile.role !== 'owner')
      throw new HttpsError('permission-denied','Solo el propietario puede crear administradores.');
    if (role === 'admin' && (await activeAdmins(stationId)).length)
      throw new HttpsError('failed-precondition','Primero desactiva al administrador anterior.');
    const email = emailValid(input.email);
    const displayName = requireString(input.name,'Nombre',100);
    const password = passwordValid(input.password);
    let created;
    try {
      created = await auth.createUser({email, displayName, password, disabled:false, emailVerified:false});
    } catch (err) {
      if (err.code === 'auth/email-already-exists') throw new HttpsError('already-exists','El correo ya tiene una cuenta.');
      throw err;
    }
    try {
      const batch = db.batch();
      const profileRef = db.doc(`users/${created.uid}`);
      batch.create(profileRef, {email, displayName, role, stationId, active:true,
        createdAt:admin.firestore.FieldValue.serverTimestamp(), createdBy:ctx.uid});
      if (role === 'admin') {
        batch.update(ctx.stationRef, {adminEmail:email, adminUid:created.uid});
      }
      const inviteRef = db.doc(`invitations/${email}`);
      const inviteSnap = await inviteRef.get();
      if (inviteSnap.exists && inviteSnap.data().stationId === stationId && inviteSnap.data().status === 'pending') {
        batch.delete(inviteRef);
      }
      const logRef = ctx.stationRef.collection('accessAudit').doc();
      batch.set(logRef, {action:'create', targetUid:created.uid,performedBy:ctx.uid,
        metadata:{email,role},createdAt:admin.firestore.FieldValue.serverTimestamp()});
      await batch.commit();
      return {ok:true, uid:created.uid};
    } catch (err) {
      await auth.deleteUser(created.uid).catch(()=>{});
      throw err;
    }
  }

  const targetUid = requireString(input.targetUid, 'Usuario',128);
  if (targetUid === ctx.uid) throw new HttpsError('permission-denied','No puedes modificar tu propio acceso aquí.');
  const targetRef = db.doc(`users/${targetUid}`);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError('not-found','Usuario no encontrado.');
  const target = targetSnap.data();
  authorizedTarget(ctx, target, action);

  if (action === 'password') {
    const password = passwordValid(input.password);
    await auth.updateUser(targetUid, {password});
    await auth.revokeRefreshTokens(targetUid);
    await audit(ctx, 'password-reset', targetUid, {role:target.role});
    return {ok:true};
  }
  if (action === 'disable') {
    // El bloqueo de Firestore se aplica primero y se refleja de inmediato en las reglas.
    const batch = db.batch();
    batch.update(targetRef,{active:false});
    if (target.role === 'admin' &&
        (ctx.station.adminUid === targetUid || ctx.station.adminEmail === target.email)) {
      batch.update(ctx.stationRef,{adminUid:admin.firestore.FieldValue.delete(),adminEmail:''});
    }
    batch.set(ctx.stationRef.collection('accessAudit').doc(), {
      action:'disable',targetUid,performedBy:ctx.uid,
      metadata:{role:target.role},createdAt:admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    // Si esta llamada falla, Firestore igualmente bloquea la cuenta; reintentar después.
    await auth.updateUser(targetUid,{disabled:true});
    await auth.revokeRefreshTokens(targetUid);
    return {ok:true};
  }
  if (action === 'enable') {
    if (target.role === 'admin' && (await activeAdmins(stationId)).some(d=>d.id!==targetUid))
      throw new HttpsError('failed-precondition','La estación ya tiene un administrador activo.');
    await auth.updateUser(targetUid,{disabled:false});
    const batch = db.batch();
    batch.update(targetRef,{active:true});
    if(target.role==='admin') batch.update(ctx.stationRef,{adminEmail:target.email,adminUid:targetUid});
    batch.set(ctx.stationRef.collection('accessAudit').doc(),{
      action:'enable',targetUid,performedBy:ctx.uid,
      metadata:{role:target.role},createdAt:admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    return {ok:true};
  }
  throw new HttpsError('invalid-argument','Acción no permitida.');
});
