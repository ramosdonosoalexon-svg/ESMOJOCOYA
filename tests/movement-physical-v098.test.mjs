import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLiquidMovements } from '../src/movementMath.js';

const base={month:'2026-11',initialDate:'2026-11-01',products:[{code:'GE',active:true},{code:'GE_PLUS',active:true}],
 tanks:[{id:'tGE',productCode:'GE',active:true}],
 initialTanks:[{tankId:'tGE',productCode:'GE',accountingLiters:17558}],
 receptions:[],
 meterShifts:[
 {date:'2026-11-01',productCode:'GE',grossVolume:8432.32,netTankOutVolume:8432.32,status:'vigente'},
 {date:'2026-11-02',productCode:'GE',grossVolume:7360.12,netTankOutVolume:7360.12,status:'vigente'}],
 inventoryReadings:[{date:'2026-11-01',tankId:'tGE',volumeLiters:9215},
 {date:'2026-11-02',tankId:'tGE',volumeLiters:1941}]};

test('Saldo físico nocturno sustituye al contable como saldo anterior del día siguiente',()=>{
 const m=buildLiquidMovements(base);
 const [d1,d2]=m.products.GE;
 assert.deepEqual([d1.beginning,d1.closing,d1.physical,d1.operationDiff],[17558,9125.68,9215,89.32]);
 assert.deepEqual([d2.beginning,d2.closing,d2.physical,d2.operationDiff],[9215,1854.88,1941,86.12]);
 const [f1,f2]=m.families.gasolina;
 assert.deepEqual([f1.beginning,f1.accounting,f1.physical,f1.operationDiff],[17558,9125.68,9215,89.32]);
 assert.deepEqual([f2.beginning,f2.accounting,f2.physical,f2.operationDiff],[9215,1854.88,1941,86.12]);
});

test('Con mezcla real, físico de tanque compartido solo se concilia en familia, sin falsear saldos por producto',()=>{
 const mixed=buildLiquidMovements({...base,
 receptions:[{date:'2026-11-01',productCode:'GE_PLUS',documentLiters:500,status:'vigente'}],
 meterShifts:[{date:'2026-11-01',productCode:'GE',netTankOutVolume:200,status:'vigente'},
 {date:'2026-11-01',productCode:'GE_PLUS',netTankOutVolume:100,status:'vigente'},
 {date:'2026-11-02',productCode:'GE',netTankOutVolume:300,status:'vigente'}],
 inventoryReadings:[{date:'2026-11-01',tankId:'tGE',volumeLiters:17748},
 {date:'2026-11-02',tankId:'tGE',volumeLiters:17440}]});
 const [one,two]=mixed.families.gasolina;
 assert.equal(one.beginning,17558);
 assert.equal(one.accounting,17758);
 assert.equal(one.physical,17748);
 assert.equal(one.operationDiff,-10);
 assert.equal(two.beginning,17748);
 assert.equal(two.accounting,17448);
 assert.equal(two.operationDiff,-8);
 assert.equal(mixed.products.GE[0].physical,null);
 assert.equal(mixed.products.GE_PLUS[0].physical,null);
});

test('Sin lectura física, no se inventa merma y se arrastra contable provisional',()=>{
 const m=buildLiquidMovements({...base,inventoryReadings:[]});
 assert.equal(m.products.GE[0].physical,null);
 assert.equal(m.products.GE[1].beginning,9125.68);
 assert.equal(m.families.gasolina[0].operationDiff,null);
 assert.equal(m.families.gasolina[1].beginning,9125.68);
});

test('Transporte se muestra por separado y no duplica la diferencia total',()=>{
 const m=buildLiquidMovements({...base,receptions:[{date:'2026-11-01',productCode:'GE',documentLiters:100,transportDifferenceL:-5,quality:'verificable_con_meters',status:'vigente'}]});
 const f=m.families.gasolina[0];
 assert.equal(f.accounting,9225.68);
 assert.equal(f.totalDiff,-10.68);
 assert.equal(f.transportDiff,-5);
 assert.equal(f.operationDiff,-5.68);
});
