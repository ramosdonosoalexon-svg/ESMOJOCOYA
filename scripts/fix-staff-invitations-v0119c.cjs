'use strict';
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const appFile = path.join(root, 'src', 'App.jsx');
const dataFile = path.join(root, 'src', 'data.js');
const rulesFile = path.join(root, 'firestore.rules');
const originals = [appFile, dataFile, rulesFile].map(file => ({file, value:fs.readFileSync(file, 'utf8')}));
const before = Object.fromEntries(originals.map(x=>[x.file,x.value]));
const marker='V0119C: cuentas e invitaciones';
if (before[appFile].includes(marker) && before[dataFile].includes(marker) && before[rulesFile].includes(marker)){
  console.log('V0119C ya instalada. No se modificó nada.');process.exit(0);
}
if (originals.some(x=>x.value.includes(marker)))throw new Error('Instalación parcial detectada. No se cambió nada. Revisa los archivos y el respaldo.');
function single(str,oldVal,newVal,context){
  const count=str.split(oldVal).length-1;
  if(count!==1)throw new Error(`Parche detenido en ${context}: se esperó 1 coincidencia, se encontraron ${count}. No se sobrescribió nada.`);
  return str.replace(oldVal,newVal);
}
let app=before[appFile],data=before[dataFile],rules=before[rulesFile];
// Operadores primero: las invitaciones no dependen de que exista administrador activo.
app=single(app, "  createStation, inviteOperator, toggleActive, toggleProduct,", "  createStation, inviteOperator, inviteAdministrator, toggleActive, toggleProduct,", 'import de gestión');
app=single(app, "  const [role,setRole]=useState(owner?'admin':'operator');\n  const [mode,setMode]=useState('direct');", "  const [role,setRole]=useState('operator');\n  const [mode,setMode]=useState('invite');", 'estado inicial de altas');
app=single(app, "function Team({stationId,uid,invitations,members,teamError,canManage,owner}) {", "function Team({stationId,uid,currentEmail,invitations,members,teamError,canManage,owner}) { // V0119C: cuentas e invitaciones", 'props de Team');
app=single(app, "{tab==='team'&&<Team stationId={stationId} uid={user.uid} invitations={invitations}", "{tab==='team'&&<Team stationId={stationId} uid={user.uid} currentEmail={user.email} invitations={invitations}", 'correo sesión');
app=single(app, "  const run=async(task,success)=>{", "  const run=async(task,success,{isInvitation=false}={})=>{", 'contexto mensajes de error');
app=single(app, "    const ok=await run(async()=>{\n      if(mode==='direct'){", "    const ok=await run(async()=>{\n      if(normalizedEmail === String(currentEmail||'').trim().toLowerCase()) throw new Error('Este es el correo con el que ingresaste. La cuenta de Gerencia o Administración ya existe; para un operador utiliza otro correo.');\n      if(members.some(m=>String(m.email||'').toLowerCase()===normalizedEmail)) throw new Error('Ese correo ya pertenece a un empleado de esta estación. Usa otra dirección.');\n      if(invitations.some(i=>String(i.email||'').toLowerCase()===normalizedEmail)) throw new Error('Ese correo ya tiene una invitación en esta estación. Revisa Invitaciones pendientes; no se puede crear otra encima.');\n      if(mode==='direct'){", 'diagnósticos email');
app=single(app,
"      }else{\n        if(role==='admin')throw new Error('La invitación del administrador se creó con la estación; para otro administrador usa la gestión directa.');\n        await inviteOperator({email:normalizedEmail,name,stationId,uid});\n      }",
"      }else if(role==='admin'){\n        if(!owner)throw new Error('Solo Gerencia puede nombrar al administrador.');\n        if(adminActive)throw new Error('Primero desactiva al administrador saliente. Gerencia continuará administrando la estación mientras tanto.');\n        await inviteAdministrator({email:normalizedEmail,name,stationId,uid});\n      }else{\n        await inviteOperator({email:normalizedEmail,name,stationId,uid,preflight:owner});\n      }",'selección del tipo de invitación');
app=single(app,
"    },mode==='direct'?'Acceso creado. Entrega la contraseña por un canal seguro y solicita que la cambien al ingresar.':'Invitación creada. El operador podrá activar su cuenta con su propio correo.');",
"    },mode==='direct'?'Acceso creado. Entrega la contraseña por un canal seguro y solicita que la cambien al ingresar.':role==='admin'?'Invitación del nuevo administrador creada. Puede activar su cuenta; Gerencia conserva el control.':'Invitación creada. El operador podrá activar su cuenta con su propio correo.',{isInvitation:mode==='invite'});", 'mensaje de alta');
const changeOld=`  const changeAccess=async(m,active)=>{\n    if(!window.confirm(\`\${active?'Desactivar':'Reactivar'} el acceso de \${m.displayName||m.email}?\`))return;\n    await run(async()=>{\n      try{await manageStaff({action:active?'disable':'enable',stationId,targetUid:m.id});}\n      catch(e){\n        // Sin Functions: Firestore puede bloquear inmediatamente las lecturas y escrituras.\n        if(active&&['functions/not-found','functions/unavailable'].includes(e?.code)){\n          await toggleActive(m.id,true);\n          return;\n        }\n        throw e;\n      }\n    },active?'Acceso desactivado. El usuario deja de tener permisos de Firestore. Sin Cloud Functions, su cuenta de Authentication seguirá existiendo.':'Acceso reactivado.');\n  };`;
const changeNew=`  const changeAccess=async(m,active)=>{\n    if(m.role==='admin'&&!owner){setError('Solo Gerencia puede cambiar el acceso de otro administrador.');return;}\n    if(!active&&m.role==='admin'&&members.some(x=>x.id!==m.id&&x.role==='admin'&&x.active)){\n      setError('Ya existe otro administrador activo. No reactives dos administradores de la misma estación.');return;\n    }\n    if(!window.confirm(\`\${active?'Desactivar':'Reactivar'} el acceso de \${m.displayName||m.email}?\`))return;\n    // La habilitación y deshabilitación de Firestore no necesita Cloud Functions.\n    await run(()=>toggleActive(m.id,active),active?'Acceso desactivado. Gerencia puede seguir administrando esta estación. La cuenta Auth permanece, pero las reglas bloquean los datos.':'Acceso reactivado.');\n  };`;
app=single(app,changeOld,changeNew,'activar/desactivar sin Functions');
app=single(app,
"      <p className=\"form-help\">Una cuenta desactivada no puede consultar datos. Las contraseñas no se guardan ni se muestran después de crearlas.</p>",
"      <p className=\"form-help\">Gerencia siempre administra la estación, con o sin administrador contratado. Tener un administrador activo nunca impide invitar operadores. Una cuenta desactivada deja de consultar datos, pero su historial permanece.</p>", 'aviso Gerencia');
app=single(app,
"        <form className=\"form-stack\" onSubmit={add}>\n          {owner&&mode==='direct'&&<label>Rol<select value={role} onChange={e=>setRole(e.target.value)}><option value=\"admin\">Administrador</option><option value=\"operator\">Operador</option></select></label>}",
"        <form className=\"form-stack\" onSubmit={add}>\n          {owner&&<label>Rol del nuevo usuario<select value={role} onChange={e=>setRole(e.target.value)}><option value=\"operator\">Operador de dispenser</option><option value=\"admin\">Administrador (reemplazo)</option></select></label>}", 'selector de rol');
app=single(app,
"          {role==='admin'&&mode==='direct'&&adminActive&&<Alert>Ya hay un administrador activo. Primero desactívalo desde la lista; luego crea el nuevo administrador.</Alert>}",
"          {role==='admin'&&adminActive&&<Alert>Para nombrar otro administrador, primero desactiva al saliente desde Empleados. Mientras tanto, Gerencia controla la estación. Esto no afecta las invitaciones de operadores.</Alert>}", 'aviso administrador');
app=single(app,
"          <p className=\"form-help\">La creación directa y el cambio de contraseñas usan Firebase Admin SDK mediante Cloud Functions (requiere plan Blaze). Las invitaciones por correo funcionan sin Functions.</p>",
"          <p className=\"form-help\">Invita al operador usando un correo propio y diferente del de Gerencia. Las invitaciones no necesitan Cloud Functions. «Asignar contraseña» y cambiar contraseñas sí requieren desplegar la función manageStaff.</p>", 'ayuda alta');
app=single(app,
"    catch(e){let msg=getError(e);\n      if(['functions/not-found','functions/unavailable'].includes(e?.code))",
"    catch(e){let msg=getError(e);\n      if(e?.code==='permission-denied'&&isInvitation) msg='La invitación fue rechazada: comprueba que uses otro correo, que no exista una invitación anterior y que las reglas actualizadas estén publicadas. La presencia del administrador no bloquea operadores.';\n      if(['functions/not-found','functions/unavailable'].includes(e?.code))", 'mensaje diagnóstico');
// Invitación nueva de administrador para sustituir al inactivo (batch atómico).
data=single(data, "export async function inviteOperator({email, name, stationId, uid}) {", "export async function inviteOperator({email, name, stationId, uid, preflight = false}) {", 'revisión previo a invitación');
data=single(data, "  // Para administradores no consultamos un documento inexistente: las reglas", "  // Gerencia puede comprobar si existe una invitación previa sin exponer otros registros.\n  if (preflight && (await getDoc(doc(db,'invitations',normalized))).exists())\n    throw new Error('Ese correo ya tiene una invitación, incluso si pertenece a otra estación. No se puede sobrescribir.');\n  // Para administradores no consultamos un documento inexistente: las reglas", 'invitaciones repetidas');
data=single(data, "export async function acceptInvitation(user) {",
`// V0119C: cuentas e invitaciones. Solo Gerencia, con administrador previo desactivado.\nexport async function inviteAdministrator({email,name,stationId,uid}) {\n  const normalized=lowerEmail(email);\n  if (!normalized || !name.trim()) throw new Error('Completa el nombre y correo del nuevo administrador.');\n  const inviteRef=doc(db,'invitations',normalized);\n  if ((await getDoc(inviteRef)).exists()) throw new Error('Este correo ya tiene una invitación registrada; usa un correo diferente.');\n  const stationRef=doc(db,'stations',stationId);\n  const batch=writeBatch(db);\n  batch.update(stationRef,{adminEmail:normalized});\n  batch.set(inviteRef,{email:normalized,name:name.trim(),role:'admin',stationId,status:'pending',createdBy:uid,createdAt:serverTimestamp()});\n  await batch.commit();\n}\nexport async function acceptInvitation(user) {`, 'datos nuevo administrador');
// Solo Gerencia puede registrar adminEmail para una nueva invitación pendiente del mismo establecimiento.
const ruleOld=`      allow update: if isOwner() &&\n        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name','city','active']);`;
const ruleNew=`      // V0119C: cuentas e invitaciones. Cambio de administrador con invitación atómica.\n      allow update: if isOwner() && (\n        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name','city','active']) ||\n        (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['adminEmail']) &&\n          request.resource.data.adminEmail is string &&\n          request.resource.data.adminEmail != resource.data.adminEmail &&\n          request.resource.data.adminEmail.size() <= 254 &&\n          existsAfter(invitationPath(request.resource.data.adminEmail)) &&\n          getAfter(invitationPath(request.resource.data.adminEmail)).data.role == 'admin' &&\n          getAfter(invitationPath(request.resource.data.adminEmail)).data.stationId == sid &&\n          getAfter(invitationPath(request.resource.data.adminEmail)).data.status == 'pending' &&\n          getAfter(invitationPath(request.resource.data.adminEmail)).data.createdBy == request.auth.uid)\n      );`;
rules=single(rules,ruleOld,ruleNew,'regla estaciones');
if(!rules.includes("(isManager(request.resource.data.stationId) && request.resource.data.role == 'operator')"))
  throw new Error('No encuentro la corrección v0.11.9b en el permiso de invitaciones. Publícala primero; sin cambios aplicados.');
const changes=[[appFile,app],[dataFile,data],[rulesFile,rules]];
const stamp='before-v0119c';
for(const {file,value} of originals){const backup=file+'.'+stamp;if(fs.existsSync(backup))throw new Error('Ya existe respaldo '+backup+'. No se sobrescribió nada.');}
// Atomicidad práctica: validar todos los patrones antes de escribir; backups de los tres archivos.
for(const {file,value} of originals)fs.writeFileSync(file+'.'+stamp,value,'utf8');
for(const [file,value] of changes)fs.writeFileSync(file,value,'utf8');
console.log('CORRECCION V0119C APLICADA. Respaldos: *.before-v0119c');
console.log('Administración y Gerencia invitan operadores; solo Gerencia invita reemplazo de administrador.');
console.log('No se modificaron libros oficiales ni registros de combustibles.');
