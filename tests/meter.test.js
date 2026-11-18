import {test} from 'node:test';import assert from 'node:assert/strict';
import {activePriceAt} from '../src/priceMath.js';
import {computeMeterShift,nextSequence,nextMeterInitial,sumDay} from '../src/meterMath.js';
const h={id:'h1',name:'M1',productCode:'GE',meterTypes:['mecanico','digital']};
const prices=[{productCode:'GE',effectiveDate:'2026-11-01',priceBs:6.96},{productCode:'GE',effectiveDate:'2026-11-08',priceBs:7.23}];
const base={date:'2026-11-07',hose:h,productCode:'GE',readings:{mecanico:{initial:100,final:110},digital:{initial:120,final:129}},primary:'mecanico',concept:'venta',priceHistory:prices};
test('precio vigente no revaloriza ventas históricas',()=>{assert.equal(activePriceAt(prices,'GE','2026-11-07').priceBs,6.96);assert.equal(activePriceAt(prices,'GE','2026-11-08').priceBs,7.23);assert.equal(computeMeterShift(base).amountBs,69.6)});
test('meter dual no suma mecánico y digital',()=>{const r=computeMeterShift(base);assert.equal(r.grossVolume,10);assert.equal(r.meterDifference,1);assert.equal(r.netTankOutVolume,10)});
test('calibración devuelta no reduce inventario neto',()=>{const r=computeMeterShift({...base,concept:'calibracion_retorno'});assert.equal(r.grossVolume,10);assert.equal(r.netTankOutVolume,0);assert.equal(r.amountBs,0)});
test('calibración vendida sí descuenta y valoriza',()=>{const r=computeMeterShift({...base,concept:'calibracion_venta'});assert.equal(r.netTankOutVolume,10);assert.equal(r.amountBs,69.6)});
test('postpago no se contabiliza cobrado',()=>{const r=computeMeterShift({...base,concept:'postpago',customer:'cliente A'});assert.equal(r.paymentStatus,'pendiente');assert.equal(r.amountBs,69.6)});
test('cliente obligatorio prepago y postpago',()=>assert.throws(()=>computeMeterShift({...base,concept:'prepago'}),/cliente/i));
test('precio obligatorio para venta',()=>assert.throws(()=>computeMeterShift({...base,priceHistory:[]}),/precio vigente/i));
test('final menor que inicial es inválido',()=>assert.throws(()=>computeMeterShift({...base,readings:{...base.readings,mecanico:{initial:100,final:90}}}),/final menor/i));
test('turno adicional no afecta otras mangueras',()=>{const rows=[{status:'vigente',date:'2026-11-07',hoseId:'h1',sequence:0,readings:{mecanico:{final:110}}},{status:'vigente',date:'2026-11-07',hoseId:'h2',sequence:0,readings:{mecanico:{final:200}}}];assert.equal(nextSequence(rows,'2026-11-07','h1'),1);assert.equal(nextSequence(rows,'2026-11-07','h2'),1);assert.equal(nextMeterInitial(rows,'2026-11-07','h1','mecanico'),110)});
test('anulaciones no cuentan en resumen',()=>{const row={...computeMeterShift(base),status:'vigente'};assert.equal(sumDay([row,{...row,status:'anulada'}],'2026-11-07','GE').grossVolume,10)});
test('un mismo arqueo reparte volumen sin duplicar salida',()=>{
  const r=computeMeterShift({...base,allocations:[{concept:'venta',volume:4},{concept:'postpago',volume:3,customer:'Empresa A'},{concept:'calibracion_retorno',volume:3}]});
  assert.equal(r.grossVolume,10);assert.equal(r.netTankOutVolume,7);assert.equal(r.returnedVolume,3);assert.equal(r.amountBs,48.72);
});
test('desglose no puede superar litros del meter',()=>assert.throws(()=>computeMeterShift({...base,allocations:[{concept:'venta',volume:11}]}),/desglose/i));
test('cambio de precio dentro de la misma fecha respeta hora',()=>{
 const intraday=[{productCode:'GE',effectiveDate:'2026-11-08',effectiveTime:'00:00',priceBs:6.96},{productCode:'GE',effectiveDate:'2026-11-08',effectiveTime:'13:00',priceBs:7.11}];
 assert.equal(activePriceAt(intraday,'GE','2026-11-08','12:00').priceBs,6.96);
 assert.equal(activePriceAt(intraday,'GE','2026-11-08','14:00').priceBs,7.11);
 assert.equal(computeMeterShift({...base,date:'2026-11-08',shiftTime:'12:00',priceHistory:intraday}).amountBs,69.6);
});
test('GNV no permite registrar devolución a tanque líquido',()=>assert.throws(()=>computeMeterShift({...base,productCode:'GNV',hose:{...h,productCode:'GNV'},concept:'calibracion_retorno'}),/GNV/i));
test('arqueos anulados reservan su índice para conservar auditoría',()=>{assert.equal(nextSequence([{status:'anulada',date:'2026-11-07',hoseId:'h1',sequence:0}],'2026-11-07','h1'),1)});
test('manguera de gasolina puede pasar a GE+ por fecha sin mezclar volumen GNV',()=>{
 const rec=computeMeterShift({...base,productCode:'GE_PLUS',priceHistory:[{productCode:'GE_PLUS',effectiveDate:'2026-11-07',priceBs:7.1}]});
 assert.equal(rec.productCode,'GE_PLUS');
 assert.throws(()=>computeMeterShift({...base,productCode:'DO'}),/manguera/i);
});
