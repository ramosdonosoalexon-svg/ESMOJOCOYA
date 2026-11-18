import test from 'node:test';import assert from 'node:assert/strict';
import {estimateTankComposition} from '../src/mixedTankEstimate.js';
const tanks=[{id:'t1',name:'TK1',productCode:'GE'}];
const hoses=[{id:'h1',feedTankIds:['t1']}];
const first={tanks,hoses,initialTanks:[{tankId:'t1',productCode:'GE',accountingLiters:100}]};
test('recepción nueva se mezcla proporcionalmente con remanente',()=>{
 const r=estimateTankComposition({...first,receptions:[{date:'2026-11-02',finishedAt:'2026-11-02T09:00',tankId:'t1',productCode:'GE_PLUS',documentLiters:100,quality:'verificable_con_meters'}],meterShifts:[{date:'2026-11-02',shiftTime:'10:00',hoseId:'h1',productCode:'GE_PLUS',netTankOutVolume:40}]})[0];
 assert.equal(r.total,160);assert.equal(r.estimatedBalances.GE,80);assert.equal(r.estimatedBalances.GE_PLUS,80);assert.equal(r.estimatedOut.GE,20);assert.equal(r.estimatedOut.GE_PLUS,20);
});
test('manguera alimentada por más de un tanque queda sin reparto',()=>{
 const r=estimateTankComposition({...first,hoses:[{id:'h1',feedTankIds:['t1','t2']}],meterShifts:[{date:'2026-11-02',shiftTime:'10:00',hoseId:'h1',productCode:'GE',netTankOutVolume:20}]})[0];
 assert.equal(r.total,100);assert.match(r.uncertainties.join('|'),/varios tanques/);
});
test('la suma de saldos no cambia por la etiqueta de venta',()=>{
 const rec=[{date:'2026-11-02',finishedAt:'2026-11-02T09:00',tankId:'t1',productCode:'GE_PLUS',documentLiters:100}];
 const f=(code)=>estimateTankComposition({...first,receptions:rec,meterShifts:[{date:'2026-11-02',shiftTime:'10:00',hoseId:'h1',productCode:code,netTankOutVolume:20}]})[0];
 assert.deepEqual(f('GE').estimatedBalances,f('GE_PLUS').estimatedBalances);
});
test('sin registros previos de saldo no inventa composición',()=>{
 const r=estimateTankComposition({tanks})[0];assert.equal(r.total,0);assert.ok(r.uncertainties.length);
});
test('salidas antes de descarga afectan solo el producto previamente existente',()=>{
 const r=estimateTankComposition({...first,receptions:[{date:'2026-11-02',finishedAt:'2026-11-02T09:00',tankId:'t1',productCode:'GE_PLUS',documentLiters:100}],meterShifts:[{date:'2026-11-02',shiftTime:'08:00',hoseId:'h1',productCode:'GE',netTankOutVolume:40},{date:'2026-11-02',shiftTime:'10:00',hoseId:'h1',productCode:'GE_PLUS',netTankOutVolume:40}]})[0];
 assert.equal(r.estimatedBalances.GE,45);
 assert.equal(r.estimatedBalances.GE_PLUS,75);
 assert.equal(r.timeline.length,3);
});
