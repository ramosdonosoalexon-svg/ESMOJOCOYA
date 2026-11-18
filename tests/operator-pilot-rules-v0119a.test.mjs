import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const original=fs.readFileSync('firestore.rules.backup-before-operator-pilot-v0119','utf8');
const fixed=fs.readFileSync('firestore.rules','utf8');
const installer=fs.readFileSync('scripts/install-operator-pilot-rules-v0119.cjs','utf8');
const anchor='      match /products/{productId} {';
const match=/const block=`([\s\S]*?)`;\s*body=body\.replace\(anchor,\(\)=>block\+anchor\);/.exec(installer);
test('instalador usa callback y no expande $\' de expresiones regulares',()=>assert.ok(match));
test('el archivo reparado es el respaldo más un único bloque',()=>assert.equal(fixed,original.replace(anchor,()=>match[1]+anchor)));
test('no hay duplicaciones en products, turnos y lecturas piloto',()=>{
  for(const phrase of ['match /products/{productId}', 'match /operatorPilotShifts/{shiftId}', 'match /operatorPilotReadings/{readingId}', 'match /operatorPilotSettings/{configId}'])assert.equal(fixed.split(phrase).length,2,phrase);
});
test('las reglas terminan en sus cierres y contienen el bloque preexistente',()=>{
 assert.ok(fixed.trimEnd().endsWith('}'));
 assert.ok(fixed.includes('match /reportSettings/{reportId}'));
 assert.ok(fixed.includes('match /meterShifts/{shiftId}'));
});
