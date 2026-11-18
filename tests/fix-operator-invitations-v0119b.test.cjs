'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const script=path.resolve(__dirname,'../scripts/fix-operator-invitations-v0119b.cjs');
const oldRule="          (isAdmin(request.resource.data.stationId) && request.resource.data.role == 'operator')";
const newRule="          (isManager(request.resource.data.stationId) && request.resource.data.role == 'operator')";
const valid=`rules_version = '2';\nmatch /invitations/{emailId} {\n${oldRule}\n}\nmatch /operatorPilotShifts/{shiftId} {\n}\nmatch /products/{productId} {\n}\n`;
function fixture(text=valid) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'invite-fix-v0119b-'));
  fs.writeFileSync(path.join(dir,'firestore.rules'),text);
  return dir;
}
function call(dir){return spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});}
test('aplica exactamente una sustitución y guarda respaldo',()=>{
  const dir=fixture();const result=call(dir);assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/CORRECCION CORRECTA/);
  const resultRules=fs.readFileSync(path.join(dir,'firestore.rules'),'utf8');
  assert.equal(resultRules,valid.replace(oldRule,newRule));
  assert.equal(fs.readFileSync(path.join(dir,'firestore.rules.backup-before-invitations-v0119b'),'utf8'),valid);
});
test('segunda ejecución es idempotente',()=>{
  const dir=fixture();assert.equal(call(dir).status,0);const once=fs.readFileSync(path.join(dir,'firestore.rules'),'utf8');
  assert.equal(call(dir).status,0);assert.equal(fs.readFileSync(path.join(dir,'firestore.rules'),'utf8'),once);
});
test('si hay duplicados se niega a alterar el archivo',()=>{
  const broken=valid+valid;const dir=fixture(broken);const result=call(dir);
  assert.notEqual(result.status,0);assert.equal(fs.readFileSync(path.join(dir,'firestore.rules'),'utf8'),broken);
  assert.equal(fs.existsSync(path.join(dir,'firestore.rules.backup-before-invitations-v0119b')),false);
});
test('si falta el piloto se niega a modificar',()=>{
  const before=valid.replace('match /operatorPilotShifts/{shiftId}', 'match /other/{id}');
  const dir=fixture(before);assert.notEqual(call(dir).status,0);
  assert.equal(fs.readFileSync(path.join(dir,'firestore.rules'),'utf8'),before);
});
