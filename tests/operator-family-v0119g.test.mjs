import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hoseFamily,availableDispenserFamilies,candidateHoses,familyHoses,familyReadingRows} from '../payload/dispenserPilotCatalog.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=n=>readFileSync(path.join(root,'payload',n),'utf8');
const stationHoses=[
 {id:'GE_A',name:'Gasolina A',productCode:'GE'},
 {id:'GE_PLUS_B',name:'Gasolina B',productCode:'GE_PLUS'},
 {id:'DO_A',name:'Diesel A',productCode:'DO'},
 {id:'ULS_A',name:'Diesel ULS',productCode:'D_ULS'},
 {id:'GNV_A',name:'GNV 1A',productCode:'GNV'},
 {id:'GNV_OFF',name:'GNV inactiva',productCode:'GNV',active:false},
];

test('familias correctas: GE/GE+ sólo gasolina, DO/ULS sólo diésel, GNV sólo GNV',()=>{
 for(const p of ['GE','GE_PLUS'])assert.equal(hoseFamily(p),'gasolina');
 for(const p of ['DO','D_ULS'])assert.equal(hoseFamily(p),'diesel');
 assert.equal(hoseFamily('GNV'),'gnv');
 assert.deepEqual(availableDispenserFamilies(stationHoses),['gasolina','diesel','gnv']);
});
test('tocar GNV muestra sólo mangueras físicas GNV activas',()=>{
 assert.deepEqual(familyHoses(stationHoses,'gnv').map(h=>h.id),['GNV_A']);
 assert.deepEqual(candidateHoses(stationHoses,'gnv',[]).map(h=>h.id),['GNV_A']);
});
test('tocar Gasolina o Diésel excluye GNV y las demás familias',()=>{
 assert.deepEqual(familyHoses(stationHoses,'gasolina').map(h=>h.id),['GE_A','GE_PLUS_B']);
 assert.deepEqual(familyHoses(stationHoses,'diesel').map(h=>h.id),['DO_A','ULS_A']);
});
test('filtrar meters ya guardados: GNV nunca muestra un meter GE',()=>{
 const readings=[{hoseId:'GE_A',productCode:'GE',mecanicoInitial:'8190882.35'},
   {hoseId:'GNV_A',productCode:'GNV',mecanicoInitial:'730966.67'}];
 const visible=familyReadingRows(readings,'gnv');
 assert.deepEqual(visible.map(x=>[x.index,x.row.hoseId]),[[1,'GNV_A']]);
 assert.deepEqual(familyReadingRows(readings,'gasolina').map(x=>[x.index,x.row.hoseId]),[[0,'GE_A']]);
 assert.equal(readings.length,2,'no borrar registros ya ingresados');
});
test('al editar o quitar un meter filtrado se mantiene su indice real',()=>{
 const readings=[{hoseId:'GE_A',productCode:'GE'}, {hoseId:'GNV_A',productCode:'GNV'}, {hoseId:'DO_A',productCode:'DO'}];
 assert.equal(familyReadingRows(readings,'gnv')[0].index,1);
 const idx=familyReadingRows(readings,'gnv')[0].index;
 assert.deepEqual(readings.filter((_,i)=>i!==idx).map(x=>x.hoseId),['GE_A','DO_A']);
});
test('la vista Lista y las tarjetas de meters aplican el filtro de familia',()=>{
 const jsx=source('OperatorPilot.jsx');
 assert.match(jsx,/familyHoses\(sortedHoses,displayedFamily\)\.map/);
 assert.match(jsx,/familyReadingRows\(entry\.readings,displayedFamily\)\.map/);
 assert.match(jsx,/onFocusFamily=\{f=>\{setActiveFamily\(f\)/);
 assert.match(jsx,/addHose\(matches\[0\]\.id,f\)/);
 assert.match(jsx,/if\(hoseFamily\(h\.productCode\)!==\(requiredFamily\|\|displayedFamily\)\)/);
});
test('la vista 3D selecciona familia al tocar pestaña o dispensador',()=>{
 const jsx=source('DispenserPilot3D.jsx');
 assert.match(jsx,/onFocusRef\.current\?\.\(f\)/);
 assert.match(jsx,/onFocusRef\.current\?\.\(family\)/);
 assert.match(jsx,/onPickRef\.current\?\.\(family\)/);
});
