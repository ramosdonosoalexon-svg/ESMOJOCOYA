import test from 'node:test';
import assert from 'node:assert/strict';
import {gasolineReceiptsByDate,mixAtDate,combineGasolineMix,estimatedPhysicalSplit,previousISO,GAS_COLOR} from '../src/gasolineVisual.js';
const tank={tankId:'t1',tankName:'Tanque compartido',sourceProduct:'GE',timeline:[
 {at:'2026-11-09T18:00',balances:{GE:200,GE_PLUS:12000}},
 {at:'2026-11-10T18:00',balances:{GE:160,GE_PLUS:21960}},
 ],uncertainties:[]};
const initial=[{tankId:'t1',productCode:'GE',accountingLiters:200}];
test('antes de recibir plus, el tanque está 100% GE',()=>{
 const mix=mixAtDate(tank,initial,'2026-11-08');assert.equal(mix.GE,200);assert.equal(mix.GE_PLUS,0);assert.equal(mix.gePct,100);
});
test('9/11 incorpora 12.000 GE+ y 10/11 otra carga',()=>{
 const a=mixAtDate(tank,initial,'2026-11-09'),b=mixAtDate(tank,initial,'2026-11-10');
 assert.equal(a.total,12200);assert.equal(a.GE_PLUS,12000);assert.equal(b.total,22120);assert.ok(b.plusPct>a.plusPct);
});
test('estimación visual escala al físico sin alterar el físico ni el contable',()=>{
 const mix=mixAtDate(tank,initial,'2026-11-09'), split=estimatedPhysicalSplit(mix,17965);
 assert.ok(Math.abs(split.GE+split.GE_PLUS-17965)<0.003);
 assert.equal(mix.total,12200);assert.equal(estimatedPhysicalSplit(mix,null),null);
});
test('sin inicial verificable no se inventa composición',()=>{
 assert.equal(mixAtDate(tank,[],'2026-11-08'),null);
 assert.equal(combineGasolineMix([tank],[],'2026-11-09'),null);
});
test('recepciones distinguidas sin doble conteo y anuladas ignoradas',()=>{
 const m=gasolineReceiptsByDate([
 {id:'a',date:'2026-11-09',productCode:'GE_PLUS',documentLiters:12000},
 {id:'b',date:'2026-11-10',productCode:'GE_PLUS',documentLiters:10000},
 {id:'c',date:'2026-11-09',productCode:'GE',documentLiters:100},
 {id:'d',date:'2026-11-09',productCode:'GE_PLUS',documentLiters:999,status:'anulada'}]);
 assert.equal(m.get('2026-11-09').GE_PLUS,12000);assert.equal(m.get('2026-11-09').GE,100);
 assert.equal(m.get('2026-11-10').GE_PLUS,10000);
});
test('fecha anterior y paleta no confunden plus con rojo de mermas',()=>{
 assert.equal(previousISO('2026-11-01'),'2026-10-31');
 assert.ok(!GAS_COLOR.GE_PLUS.toLowerCase().startsWith('#b9'));
});
