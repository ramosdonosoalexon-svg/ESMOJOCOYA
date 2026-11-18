import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLiquidMovements} from '../src/movementMath.js';
const data={
 month:'2026-11',products:[{code:'GE',active:true},{code:'GE_PLUS',active:true}],initialDate:'2026-11-01',
 tanks:[{id:'T',productCode:'GE',active:true}],initialTanks:[{tankId:'T',productCode:'GE',accountingLiters:17558}],
 receptions:[{date:'2026-11-09',productCode:'GE_PLUS',documentLiters:12000},{date:'2026-11-10',productCode:'GE_PLUS',documentLiters:10000}],
 meterShifts:[{date:'2026-11-09',productCode:'GE',netTankOutVolume:8866.72,grossVolume:8866.72,amountBs:60842.38},
              {date:'2026-11-10',productCode:'GE',netTankOutVolume:9284.37,grossVolume:9284.37,amountBs:63088.02}],
 inventoryReadings:[{date:'2026-11-09',tankId:'T',volumeLiters:17965},{date:'2026-11-10',tankId:'T',volumeLiters:18730}]
};
test('conjunto muestra recepciones PLUS en ambos días y meters una sola vez',()=>{
 const m=buildLiquidMovements(data);
 const d9=m.families.gasolina.find(x=>x.date==='2026-11-09');
 const d10=m.families.gasolina.find(x=>x.date==='2026-11-10');
 assert.equal(d9.receiptL,12000);assert.equal(d10.receiptL,10000);
 assert.equal(d9.grossOutL,8866.72);assert.equal(d10.grossOutL,9284.37);
 assert.equal(d9.physical,17965);assert.equal(d10.physical,18730);
 assert.equal(d10.beginning,17965);assert.equal(d10.amountBs,63088.02);
});
test('GE+ puede tener recepción sin metros propios mientras GE factura los despachos',()=>{
 const m=buildLiquidMovements(data);
 const ge=m.products.GE.find(x=>x.date==='2026-11-10');
 const plus=m.products.GE_PLUS.find(x=>x.date==='2026-11-10');
 assert.equal(plus.receiptL,10000);assert.equal(plus.grossOutL,null);assert.equal(ge.grossOutL,9284.37);
});
