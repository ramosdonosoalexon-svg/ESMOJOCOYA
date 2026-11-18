import {test} from 'node:test';
import assert from 'node:assert/strict';
import {meterHoseDaySummary,meterFamilyDayTotal,effectiveDayShifts} from '../src/meterSummary.js';
import {nextMeterInitial,openingMeterValue,sumDay} from '../src/meterMath.js';
import {buildLiquidMovements} from '../src/movementMath.js';
const day='2026-11-01';
const row=(sequence,hoseId,productCode,initial,final,status='vigente')=>({
 date:day,hoseId,productCode,sequence,status,shiftTime:`0${8+sequence}:00`,grossVolume:final-initial,
 readings:{mecanico:{initial,final},digital:{initial:initial+100,final:final+100}}
});
const diesel=[row(0,'DO5A','DO',1000,1050),row(1,'DO5A','DO',1050,1120),row(0,'DO5B','DO',2000,2100)];
test('La tabla superior muestra inicial/final y suma los turnos de una manguera',()=>{
 const v=meterHoseDaySummary(diesel,day,['DO'],'DO5A');
 assert.equal(v.count,2);assert.equal(v.readings.mecanico.initial,1000);assert.equal(v.readings.mecanico.final,1120);
 assert.equal(v.readings.digital.initial,1100);assert.equal(v.readings.digital.final,1220);
 assert.equal(v.grossVolume,120);
});
test('No se suman dos veces los meters mecánico y digital',()=>assert.equal(meterFamilyDayTotal(diesel,day,['DO']),220));
test('La tabla de Gasolina no muestra los datos de Diesel',()=>{
 assert.equal(meterHoseDaySummary(diesel,day,['GE','GE_PLUS'],'DO5A'),null);
 assert.equal(effectiveDayShifts(diesel,day,['GE','GE_PLUS']).length,0);
});
test('Compatibilidad con arqueos antiguos sin campo status; igual que Movimientos',()=>{
 const old={...row(0,'DO5C','DO',100,115),status:undefined};
 assert.equal(meterHoseDaySummary([old],day,['DO'],'DO5C').grossVolume,15);
 assert.equal(nextMeterInitial([old],day,'DO5C','mecanico'),115);
 assert.equal(openingMeterValue([old],day,'DO5C','mecanico',[],'2026-11-01'),115);
 assert.equal(sumDay([old],day,'DO').grossVolume,15);
});
test('Anulaciones se excluyen tanto de Meters como de Movimientos',()=>{
 const canceled={...row(0,'DO5A','DO',1120,2000),status:'anulada'};
 const model=buildLiquidMovements({month:'2026-11',products:[{code:'DO',active:true}],tanks:[],initialTanks:[],initialDate:day,meterShifts:[...diesel,canceled]});
 assert.equal(meterFamilyDayTotal([...diesel,canceled],day,['DO']),220);
 assert.equal(model.products.DO.find(r=>r.date===day).grossOutL,220);
});
test('Dos gasolinas usan la misma manguera y preservan el meter continuo',()=>{
 const g1=row(0,'GE3A','GE',500,540),g2=row(1,'GE3A','GE_PLUS',540,620);
 const v=meterHoseDaySummary([g1,g2],day,['GE','GE_PLUS'],'GE3A');
 assert.equal(v.count,2);assert.equal(v.grossVolume,120);
 assert.deepEqual(v.products,['GE','GE_PLUS']);
 assert.equal(v.readings.mecanico.initial,500);assert.equal(v.readings.mecanico.final,620);
});
