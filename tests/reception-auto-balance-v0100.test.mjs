import test from 'node:test';
import assert from 'node:assert/strict';
import {accountingBeforeReception,productBeforeReception,receptionChangeNote} from '../src/receptionAccounting.js';
const tank={id:'T1',productCode:'GE',active:true};
const tankInit=[{tankId:'T1',productCode:'GE',accountingLiters:674}];
const hoses=[{id:'H1',feedTankIds:['T1']}];
const base={tank,productCode:'GE',date:'2026-11-10',time:'14:30',initialDate:'2026-11-01',initialTanks:tankInit,receptions:[],meterShifts:[],hoses,tanks:[tank]};
const calc=(overrides={})=>accountingBeforeReception({...base,...overrides});
test('GE -> GE+ toma remanente de Datos iniciales, sin pedir ingreso manual',()=>assert.deepEqual(calc(),{value:674,error:null}));
test('descuenta meters de días anteriores, conserva el neto',()=>{
 const meterShifts=[{id:'1',date:'2026-11-09',shiftTime:'08:00',hoseId:'H1',productCode:'GE',netTankOutVolume:200,status:'vigente'}];
 assert.equal(calc({meterShifts}).value,474);
});
test('suma anteriores recepciones del mismo producto y otros ingresos',()=>{
 const receptions=[{date:'2026-11-09',tankId:'T1',productCode:'GE',documentLiters:1000,otherIncomeLiters:20,finishedAt:'2026-11-09T10:40',status:'vigente'}];
 assert.equal(calc({receptions}).value,1694);
});
test('descarga del mismo día posterior al momento de corte NO cuenta',()=>{
 const receptions=[{date:'2026-11-10',tankId:'T1',productCode:'GE',documentLiters:1000,otherIncomeLiters:0,finishedAt:'2026-11-10T16:00'}];
 assert.equal(calc({receptions}).value,674);
});
test('despachos anteriores a la descarga sí cuentan, posteriores no',()=>{
 const meterShifts=[{date:'2026-11-10',shiftTime:'09:00',hoseId:'H1',productCode:'GE',netTankOutVolume:40},
 {date:'2026-11-10',shiftTime:'16:00',hoseId:'H1',productCode:'GE',netTankOutVolume:700}];
 assert.equal(calc({meterShifts}).value,634);
});
test('anulados no alteran saldo',()=>{
 assert.equal(calc({meterShifts:[{date:'2026-11-09',hoseId:'H1',productCode:'GE',netTankOutVolume:333,status:'anulada'}]}).value,674);
});
test('mangueras compartidas entre múltiples tanques requieren vínculo real',()=>{
 const second={id:'T2',productCode:'GE_PLUS',active:true};
 const result=calc({tanks:[tank,second],hoses:[{id:'H1',feedTankIds:['T1','T2']}],meterShifts:[{date:'2026-11-09',hoseId:'H1',productCode:'GE',netTankOutVolume:10}]});
 assert.equal(result.value,null);assert.match(result.error,/no está asignado/);
});
test('saldo negativo se denuncia sin convertirlo a cero falso',()=>{
 const r=calc({meterShifts:[{date:'2026-11-09',hoseId:'H1',productCode:'GE',netTankOutVolume:1000}]});
 assert.equal(r.value,null);assert.match(r.error,/negativo/);
});
test('hora necesaria para saldo al momento de descargar',()=>assert.match(calc({time:''}).error,/hora/));
test('producto previo se detecta en las recepciones históricas',()=>{
 const receptions=[{date:'2026-11-07',tankId:'T1',productCode:'GE_PLUS',finishedAt:'2026-11-07T12:15',status:'vigente'}];
 assert.equal(productBeforeReception({tank,initialTanks:tankInit,receptions,date:'2026-11-10',time:'14:30'}),'GE_PLUS');
});
test('notas opcionales guardan constancia neutral, sin inventar autorización',()=>{
 const note=receptionChangeNote('',true);assert.match(note,/sin observación ni autorización documentada/);
 assert.equal(receptionChangeNote('',false),'');
 assert.equal(receptionChangeNote('Autorizado supervisor',true),'Autorizado supervisor');
 assert.throws(()=>receptionChangeNote('ok',true),/8 caracteres/);
});
