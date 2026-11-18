'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const root=process.cwd();
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
const data=fs.readFileSync(path.join(root,'src/data.js'),'utf8');
const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
const count=(s,p)=>(s.match(p)||[]).length;
test('selector de operador por defecto, sin depender de administrador activo',()=>{
  assert.match(app,/const \[role,setRole\]=useState\('operator'\)/);
  assert.match(app,/const \[mode,setMode\]=useState\('invite'\)/);
  assert.match(app,/disabled=\{busy\|\|\(role==='admin'&&adminActive\)\}/);
});
test('impide invitar la propia cuenta y repetir correo de personal',()=>{
  assert.match(app,/normalizedEmail === String\(currentEmail\|\|''\)/);
  assert.match(app,/members\.some\(m=>String\(m\.email\|\|''\)/);
});
test('antes de crear, Gerencia verifica invitaciones existentes',()=>{
  assert.match(app,/preflight:owner/);
  assert.match(data,/preflight && \(await getDoc\(doc\(db,'invitations',normalized\)\)\)\.exists\(\)/);
});
test('Gerencia puede invitar nuevo administrador tras desactivar el anterior',()=>{
  assert.match(app,/if\(adminActive\)throw new Error\('Primero desactiva/);
  assert.match(app,/inviteAdministrator\(\{email:normalizedEmail,name,stationId,uid\}\)/);
  assert.match(data,/batch\.update\(stationRef,\{adminEmail:normalized\}\)/);
  assert.match(data,/batch\.set\(inviteRef,\{email:normalized,name:name\.trim\(\),role:'admin'/);
});
test('desactivar y reactivar accesos usa Firestore, no Functions',()=>{
  assert.match(app,/await run\(\(\)=>toggleActive\(m\.id,active\)/);
  assert.doesNotMatch(app,/await manageStaff\(\{action:active\?'disable':'enable'/);
});
test('la regla nueva solo habilita cambiar adminEmail a Gerencia y exige invitación correspondiente',()=>{
  assert.match(rules,/allow update: if isOwner\(\) && \(\s*request\.resource\.data\.diff\(resource\.data\)/);
  assert.match(rules,/affectedKeys\(\)\.hasOnly\(\['adminEmail'\]\)/);
  assert.match(rules,/existsAfter\(invitationPath\(request\.resource\.data\.adminEmail\)\)/);
  assert.match(rules,/getAfter\(invitationPath\(request\.resource\.data\.adminEmail\)\)\.data\.stationId == sid/);
});
test('mantiene regla Gerencia y Administración para operadores',()=>{
  assert.match(rules,/\(isManager\(request\.resource\.data\.stationId\) && request\.resource\.data\.role == 'operator'\)/);
  assert.equal(count(rules,/match \/invitations\/\{emailId\}/g),1);
  assert.equal(count(rules,/match \/operatorPilotShifts\/\{shiftId\}/g),1);
});
test('la actualización no duplica reglas ni elimina secciones',()=>{
  assert.equal(count(rules,/match \/stations\/\{sid\}/g),1);
  assert.equal(count(rules,/match \/products\/\{productId\}/g),1);
  assert.equal(count(rules,/match \/users\/\{uid\}/g),1);
  assert.equal(count(rules,/V0119C: cuentas e invitaciones/g),1);
});
