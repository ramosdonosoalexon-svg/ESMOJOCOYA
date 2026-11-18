import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 meterHoseDayCell,meterConsistencyReport,meterFamilyDayTotal,
 meterOrphanDayRecords,lastConfirmedReadings
} from '../src/meterSummary.js';
import {buildLiquidMovements} from '../src/movementMath.js';
import {openingMeterValue} from '../src/meterMath.js';
const day='2026-11-01', initialDate='2026-11-01';
const initialMeters=[{id:'geA',hoseId:'geA',readings:{mecanico:12345.123,digital:76543.111}},
 {id:'gnvA',hoseId:'gnvA',readings:{digital:2150.5}}];
const shift=(id, hoseId, date, productCode, ini, fin, extra={})=>({
 id,hoseId,hoseName: hoseId==='legacy01'?'LADO GE 3A':hoseId,
 date,productCode,grossVolume:fin-ini,sequence:0,shiftTime:'18:00',
 readings:{mecanico:{initial:ini,final:fin}},...extra
});

test('31/10 muestra la lectura base como cierre anterior sin inventar despacho',()=>{
 const cell=meterHoseDayCell([], '2026-10-31',['GE','GE_PLUS'],'geA',initialMeters,initialDate);
 assert.equal(cell.kind,'anchor');
 assert.equal(cell.readings.mecanico,12345.123);
 assert.equal(cell.readings.digital,76543.111);
 assert.equal(cell.summary,undefined);
 assert.equal(meterHoseDayCell([], '2026-10-30',['GE'],'geA',initialMeters,initialDate).kind,'none');
});

test('01/11 sin despacho muestra el inicial y final pendiente, no 0 ni falso despacho',()=>{
 const cell=meterHoseDayCell([],day,['GE','GE_PLUS'],'geA',initialMeters,initialDate);
 assert.equal(cell.kind,'pending');
 assert.equal(cell.readings.mecanico,12345.123);
 assert.equal(meterFamilyDayTotal([],day,['GE','GE_PLUS']),0);
});

test('01/11 con arqueo muestra inicial, último final y litros realmente guardados',()=>{
 const records=[shift('s1','geA',day,'GE',12345.123,12425.123)];
 const cell=meterHoseDayCell(records,day,['GE','GE_PLUS'],'geA',initialMeters,initialDate);
 assert.equal(cell.kind,'recorded');
 assert.equal(cell.summary.readings.mecanico.initial,12345.123);
 assert.equal(cell.summary.readings.mecanico.final,12425.123);
 assert.ok(Math.abs(cell.summary.grossVolume-80)<0.00001);
 const next=meterHoseDayCell(records,'2026-11-02',['GE','GE_PLUS'],'geA',initialMeters,initialDate);
 assert.equal(next.kind,'pending');
 assert.equal(next.readings.mecanico,12425.123);
});

test('GNV tiene lectura base el 31/10 y no despacho inventado para el 1/11',()=>{
 const prior=meterHoseDayCell([], '2026-10-31',['GNV'],'gnvA',initialMeters,initialDate);
 const current=meterHoseDayCell([],day,['GNV'],'gnvA',initialMeters,initialDate);
 assert.equal(prior.kind,'anchor');assert.equal(prior.readings.digital,2150.5);
 assert.equal(current.kind,'pending');assert.equal(current.readings.digital,2150.5);
});

test('Cuando Movimientos tiene 8432,32 L y el ID ya no está en Configuración, se advierte el volumen',()=>{
 const records=[shift('legacy','legacy01',day,'GE',1000,9432.32,{status:undefined})];
 const audit=meterConsistencyReport(records,day,['GE','GE_PLUS'],['geA']);
 assert.equal(audit.count,1);
 assert.ok(Math.abs(audit.total-8432.32)<0.001);
 assert.equal(audit.orphan.length,1);
 assert.equal(audit.linked,0);
 const movements=buildLiquidMovements({month:'2026-11',products:[{code:'GE',active:true}],tanks:[],initialTanks:[],initialDate:day,meterShifts:records});
 assert.ok(Math.abs(movements.products.GE[0].grossOutL-8432.32)<0.001);
 assert.equal(meterHoseDayCell(records,day,['GE','GE_PLUS'],'geA',initialMeters,initialDate).kind,'pending');
});

test('Turnos anteriores y anulados no deben alterar la continuidad',()=>{
 const records=[
  shift('old','geA','2026-11-01','GE',100,120),
  shift('new','geA','2026-11-02','GE_PLUS',120,145),
  shift('cancel','geA','2026-11-02','GE_PLUS',145,999,{status:'anulada'})];
 assert.equal(lastConfirmedReadings(records,'geA','2026-11-02',initialMeters,initialDate).mecanico,120);
 assert.equal(lastConfirmedReadings(records,'geA','2026-11-03',initialMeters,initialDate).mecanico,145);
 assert.equal(meterOrphanDayRecords(records,'2026-11-02',['GE','GE_PLUS'],['geA']).length,0);
});


test('Datos iniciales prevalecen frente a pruebas antiguas anteriores al inicio operativo',()=>{
 const old=[shift('oct','geA','2026-10-30','GE',777,888)];
 assert.equal(openingMeterValue(old,day,'geA','mecanico',initialMeters,initialDate),12345.123);
 assert.equal(lastConfirmedReadings(old,'geA',day,initialMeters,initialDate).mecanico,12345.123);
});
