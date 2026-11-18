import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveInternationalRate,computeInternationalSale,internationalMonthlyLedger} from '../src/internationalPricing.js';
import {computeMeterShift} from '../src/meterMath.js';
import {classifyGnvShifts} from '../src/gnvRiskMath.js';
const jan={productCode:'GE',effectiveDate:'2026-01-01',effectiveTime:'00:00',internationalPriceBs:8.68,differentialBs:1.72,resolutionNumber:'ANH-2026-001'};
const mar={...jan,effectiveDate:'2026-03-02',internationalPriceBs:8.68,differentialBs:1.5,resolutionNumber:'ANH-2026-002'};
const zero={...jan,productCode:'DO',internationalPriceBs:9.8,differentialBs:0};
const prices=[{productCode:'GE',effectiveDate:'2026-01-01',effectiveTime:'00:00',priceBs:6.96},
 {productCode:'DO',effectiveDate:'2026-01-01',effectiveTime:'00:00',priceBs:9.8}];
const hose={id:'hose-ge',name:'LADO GE 3A',productCode:'GE',meterTypes:['mecanico','digital']};
const readings={mecanico:{initial:2000,final:2100},digital:{initial:2000,final:2100}};
const make=(options={})=>computeMeterShift({date:'2026-02-01',shiftTime:'12:00',hose,productCode:'GE',readings,primary:'mecanico',priceHistory:prices,internationalHistory:[jan,mar],sequence:0,...options});
test('Selecciona tarifa segun fecha, no reescribe precios anteriores',()=>{
 assert.equal(effectiveInternationalRate([jan,mar],'GE','2026-02-01').differentialBs,1.72);
 assert.equal(effectiveInternationalRate([jan,mar],'GE','2026-03-05').differentialBs,1.5);
 assert.equal(effectiveInternationalRate([jan],'GE','2025-12-31'),null);
});
test('Valora factura internacional con diferencial ANH, sin descontar litros otra vez',()=>{
 const result=make({allocations:[{concept:'venta_internacional',volume:25,reference:'FACT-203'}]});
 assert.equal(result.grossVolume,100); assert.equal(result.netTankOutVolume,100);
 assert.equal(result.movementLines.length,2);
 assert.equal(result.movementLines[0].amountBs,217);
 assert.equal(result.movementLines[0].ypfbDifferentialBs,43);
 assert.equal(result.movementLines[0].stationRevenueBs,174);
 assert.equal(result.movementLines[1].concept,'venta');
 assert.equal(result.movementLines[1].volume,75);
 assert.equal(result.amountBs,739); // 25*8.68 + 75*6.96
});
test('No clasifica como internacional ventas normales',()=>{
 const result=make({allocations:[]});
 assert.equal(result.movementLines[0].concept,'venta');
 assert.equal(result.movementLines[0].amountBs,696);
 assert.equal(result.movementLines[0].ypfbDifferentialBs,undefined);
});
test('Un diferencial oficial cero queda en cero, no como resta inventada',()=>{
 assert.equal(computeInternationalSale(100,zero,'F-2026').ypfbDifferentialBs,0);
});
test('Rechaza tarifa ausente y factura sin referencia',()=>{
 assert.throws(()=>make({internationalHistory:[],allocations:[{concept:'venta_internacional',volume:5,reference:'F-1'}]}),/tarifa|precio internacional/i);
 assert.throws(()=>make({allocations:[{concept:'venta_internacional',volume:5,reference:''}]}),/factura/i);
});
test('No se permite superar los litros del meter',()=>{
 assert.throws(()=>make({allocations:[{concept:'venta_internacional',volume:101,reference:'FACT-01'}]}),/superar/i);
});
test('Consolida solo facturas internacionales vigentes, no anuladas ni ventas normales',()=>{
 const valid={...make({allocations:[{concept:'venta_internacional',volume:25,reference:'FACT-203'}]}),id:'r-1',status:'vigente'};
 const canceled={...valid,id:'r-2',status:'anulada'};
 const domestic={...make({allocations:[]}),id:'r-3',status:'vigente'};
 const ledger=internationalMonthlyLedger([valid,canceled,domestic],[{id:'d1',period:'2026-02',date:'2026-03-02',amountBs:30}], '2026-02');
 assert.equal(ledger.docs.length,1);assert.equal(ledger.gross,217);
 assert.equal(ledger.station,174); assert.equal(ledger.ypfb,43);
 assert.equal(ledger.deposited,30); assert.equal(ledger.remaining,13);
 assert.equal(ledger.byProduct.GE.count,1);
});
test('No mezcla periodos de depósito, permite depósito posterior vinculado al mes',()=>{
 const ledger=internationalMonthlyLedger([], [{period:'2026-03',amountBs:55},{period:'2026-02',amountBs:33}], '2026-02');
 assert.equal(ledger.deposited,33); assert.equal(ledger.remaining,-33);
});
test('GNV internacional clasifica como contado y no como litros sin clasificar',()=>{
 const result=classifyGnvShifts([{productCode:'GNV',grossVolume:20, status:'vigente',movementLines:[{concept:'venta_internacional',volume:12},{concept:'venta',volume:8}]}]);
 assert.equal(result.categories.contado,20);assert.equal(result.categories.sinClasificar,0);
});
test('La tarifa no puede tener diferencial negativo o superior al precio',()=>{
 assert.throws(()=>computeInternationalSale(10,{...jan,differentialBs:-1},'FACT-1'),/precio internacional|diferencial/i);
 assert.throws(()=>computeInternationalSale(10,{...jan,differentialBs:9},'FACT-1'),/precio internacional|diferencial/i);
});
test('La misma factura no se declara dos veces en un arqueo',()=>{
 assert.throws(()=>make({allocations:[
  {concept:'venta_internacional',volume:10,reference:'FACT-777'},
  {concept:'venta_internacional',volume:20,reference:'fact-777'}]}),/misma factura/i);
});
