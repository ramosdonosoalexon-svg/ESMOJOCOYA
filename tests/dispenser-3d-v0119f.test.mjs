import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {hoseFamily,availableDispenserFamilies,candidateHoses,familyFromModelName,MODEL_PARTS,PRM_NAME} from '../payload/dispenserPilotCatalog.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load=n=>readFileSync(path.join(root,'payload',n));

test('producto GE y GE+ sólo usan modelo de gasolina',()=>{
 assert.equal(hoseFamily('GE'),'gasolina');assert.equal(hoseFamily('GE_PLUS'),'gasolina');
 assert.equal(hoseFamily('DO'),'diesel');assert.equal(hoseFamily('D_ULS'),'diesel');
 assert.equal(hoseFamily('GNV'),'gnv');assert.equal(hoseFamily('otro'),null);
});
test('familias sólo aparecen para las mangueras activas de la estación',()=>{
 assert.deepEqual(availableDispenserFamilies([{id:'a',productCode:'GE'},{id:'b',productCode:'GNV'},{id:'c',productCode:'DO',active:false}]),['gasolina','gnv']);
});
test('el modelo de una familia no inventa asignación individual',()=>{
 const hoses=[{id:'a',name:'A1',productCode:'GE'}, {id:'b',name:'A2',productCode:'GE_PLUS'}, {id:'c',name:'B1',productCode:'DO'}, {id:'d',name:'C1',productCode:'GNV'}];
 assert.deepEqual(candidateHoses(hoses,'gasolina',['a']).map(h=>h.id),['b']);
 assert.deepEqual(candidateHoses(hoses,'diesel',[]).map(h=>h.id),['c']);
 assert.deepEqual(candidateHoses(hoses,'gnv',[]).map(h=>h.id),['d']);
});
test('cada modelo reconoce dispenser y manguera por nombre sin aproximaciones',()=>{
 for(const [family,parts] of Object.entries(MODEL_PARTS)){
  assert.equal(familyFromModelName(parts.dispenser),family);
  assert.equal(familyFromModelName(parts.hose),family);
 }
 assert.equal(familyFromModelName(PRM_NAME),null);
});
test('el GLB que envió el usuario tiene siete piezas y mangueras enlazadas',()=>{
 const b=load('Petro_Surtidores_PRM.glb');
 assert.equal(b.subarray(0,4).toString(),'glTF');assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.length);
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));
 assert.equal(j.nodes.length,7);assert.equal(j.meshes.length,7);
 for(const [family,parts] of Object.entries(MODEL_PARTS)){
  const d=j.nodes.find(n=>n.name===parts.dispenser);
  const hoseIdx=j.nodes.findIndex(n=>n.name===parts.hose);
  assert.ok(d&&d.children.includes(hoseIdx),family+' debe mantener manguera enlazada');
 }
 assert.ok(j.nodes.find(n=>n.name===PRM_NAME));
});
test('el parche usa el GLB existente y conserva el código de registro de turno',()=>{
 const jsx=load('OperatorPilot.jsx').toString('utf8');
 assert.match(jsx,/import DispenserPilot3D from '\.\/DispenserPilot3D\.jsx'/);
 assert.match(jsx,/onSelectFamily=\{chooseModelFamily\}/);
 assert.match(jsx,/hoseView==='lista'/);
 assert.match(jsx,/function addHose\(hoseId\)/);
 assert.match(jsx,/operatorPilotValidation\(working\)/);
 assert.doesNotMatch(jsx,/meterShifts\//);
});
