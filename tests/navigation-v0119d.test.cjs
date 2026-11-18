'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(process.cwd(),'src','App.jsx');
if(!fs.existsSync(file))throw new Error('Ejecuta las pruebas en la raiz de distrigasliquidos.');
const s=fs.readFileSync(file,'utf8');
const sections=s.match(/const sections=\[[\s\S]*?\n\];/)?.[0];

test('v0.11.9d instalada',()=>assert.match(s,/V0119D: menu lateral y permisos de reportes/));
test('Arqueos operadores visibles en menu lateral para Gerencia y Administracion',()=>{
  assert.match(s,/canSeeManagement&&<button[^\n]*openArea\('operatorPilot'\)/);
  assert.match(s,/initialTab="operatorPilot"/);
  assert.match(s,/tab==='operatorPilot'&&<OperatorPilot/);
});
test('Reportes ANH, Sustancias e Impuestos mantienen su menu lateral',()=>{
  for(const id of ['anh','sustancias','impuestos'])assert.match(s,new RegExp("\\{id:'"+id+"'"));
  assert.match(s,/canSeeManagement&&<>[\s\S]*?reportLinks\.map[\s\S]*?<\/nav>[\s\S]*?<\/>/);
});
test('Las pestanas de estaciones no duplican arqueos ni reportes',()=>{
  assert.ok(sections,'La lista sections debe existir');
  for(const id of ['operatorPilot','anhReports','sustanciasReports'])assert.doesNotMatch(sections,new RegExp("\\{id:'"+id+"'"));
  assert.doesNotMatch(s,/\{tab==='anhReports'&&/);
  assert.doesNotMatch(s,/\{tab==='sustanciasReports'&&/);
});
test('El operador solo ve StationDashboard, incluso si area conserva una ruta de informe',()=>{
  assert.match(s,/\{profile\.role==='operator'\s*\? <StationDashboard stationId=\{profile\.stationId\}/);
  assert.match(s,/const canSeeManagement=profile\.role==='owner'\|\|profile\.role==='admin';/);
  assert.match(s,/profile\.active!==true/);
});
