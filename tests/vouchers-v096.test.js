import {test} from 'node:test';
import assert from 'node:assert/strict';
import {computeMeterShift} from '../src/meterMath.js';
import {voucherAccountStatement,validateVoucherAllocations} from '../src/voucherMath.js';
import {buildLiquidMovements} from '../src/movementMath.js';

const h={id:'h1',name:'LADO GE 4B',productCode:'GE',meterTypes:['mecanico','digital']};
const prices=[{productCode:'GE',effectiveDate:'2026-11-01',effectiveTime:'00:00',priceBs:6.96}];
const base={date:'2026-11-01',shiftTime:'08:00',hose:h,productCode:'GE',
 readings:{mecanico:{initial:2842805.06,final:2843389.97},digital:{initial:2842805.06,final:2843389.97}},
 primary:'mecanico',priceHistory:prices};
const prepago={id:'a1',name:'Policía',mode:'prepago',active:true};
const postpago={id:'a2',name:'Municipio',mode:'postpago',active:true};
const abonos=[{accountId:'a1',kind:'recarga_prepago',date:'2026-11-01',amountBs:3000,id:'p1'}];
const line=(concept,volume,id,customer)=>({concept,volume,voucherAccountId:id,customer,reference:'Vale 01'});

test('310 L especiales y 274,91 L normales completan un meter de 584,91 L',()=>{
 const r=computeMeterShift({...base,allocations:[line('prepago',300,'a1','Policía'),line('prepago',10,'a1','Policía')]});
 assert.equal(r.grossVolume,584.91);assert.equal(r.movementLines.length,3);
 assert.equal(r.movementLines.at(-1).concept,'venta');assert.equal(r.movementLines.at(-1).volume,274.91);
 assert.equal(r.netTankOutVolume,584.91);
 assert.equal(r.amountBs,4070.97);
});
test('el desglose jamás puede superar el meter',()=>{
 assert.throws(()=>computeMeterShift({...base,allocations:[{concept:'prepago',volume:585,customer:'Policía'}]}),/no puede superar/);
});
test('sin detalles todo se registra como venta normal',()=>{
 const r=computeMeterShift({...base,allocations:[]});assert.equal(r.movementLines[0].concept,'venta');assert.equal(r.movementLines[0].volume,584.91);
});
test('limpieza y consumo propio descuentan producto sin recircular',()=>{
 const r=computeMeterShift({...base,allocations:[{concept:'limpieza',volume:30,reference:'Purga del tanque'},
   {concept:'consumo_propio',volume:50,reference:'Uso interno'}]});
 assert.equal(r.grossVolume,584.91);assert.equal(r.returnedVolume,0);assert.equal(r.netTankOutVolume,584.91);
 assert.equal(r.movementLines.at(-1).volume,504.91);
});
test('calibración devuelta recircula y calibración vendida sí sale',()=>{
 const r=computeMeterShift({...base,allocations:[{concept:'calibracion_retorno',volume:40,reference:'Acta calibración'},
   {concept:'calibracion_venta',volume:10,reference:'Factura 01'}]});
 assert.equal(r.returnedVolume,40);assert.equal(r.netTankOutVolume,544.91);
 const movement=buildLiquidMovements({month:'2026-11',products:[{code:'GE',active:true}],tanks:[{id:'t1',productCode:'GE',active:true}],initialTanks:[{productCode:'GE',accountingLiters:1000}],initialDate:'2026-11-01',meterShifts:[{...r,status:'vigente'}]});
 assert.equal(movement.products.GE[0].grossOutL,584.91);
 assert.equal(movement.products.GE[0].returnedL,40);
 assert.equal(movement.products.GE[0].outL,544.91);
 assert.equal(movement.products.GE[0].closing,455.09);
 assert.equal(movement.products.GE[0].lines.calibracion_retorno,40);
 assert.equal(movement.products.GE[0].lines.calibracion_venta,10);
});
test('saldo prepago se descuenta por Bs de vales y sus recargas',()=>{
 const shift={id:'s1',status:'vigente',...computeMeterShift({...base,allocations:[line('prepago',300,'a1','Policía'),line('prepago',10,'a1','Policía')]})};
 const s=voucherAccountStatement(prepago,[shift],abonos,'2026-11');
 assert.equal(s.creditsBs,3000);assert.equal(s.dispensedBs,2157.60);assert.equal(s.balanceBs,842.40);
 assert.equal(s.periodLiters,310);
 assert.equal(validateVoucherAllocations([line('prepago',1,'a1','Policía')].map(l=>({...l,amountBs:6.96})),[prepago],[shift],abonos),true);
 assert.throws(()=>validateVoucherAllocations([{...line('prepago',200,'a1','Policía'),amountBs:1392}], [prepago],[shift],abonos),/insuficiente/);
});
test('postpago acumula deuda y su cobro mensual la reduce',()=>{
 const shift={id:'s2',status:'vigente',...computeMeterShift({...base,allocations:[line('postpago',50,'a2','Municipio')]})};
 const st=voucherAccountStatement(postpago,[shift],[{accountId:'a2',kind:'cobro_postpago',amountBs:100,date:'2026-11-30'}],'2026-11');
 assert.equal(st.dispensedBs,348);assert.equal(st.creditsBs,100);assert.equal(st.balanceBs,248);
});
test('anulaciones no consumen prepago ni aumentan deuda',()=>{
 const shift={id:'s',status:'anulada',...computeMeterShift({...base,allocations:[line('postpago',50,'a2','Municipio')]})};
 assert.equal(voucherAccountStatement(postpago,[shift],[]).balanceBs,0);
});
test('no se puede cargar un vale a una cuenta con modalidad incorrecta',()=>{
 assert.throws(()=>validateVoucherAllocations([{...line('prepago',5,'a2','Municipio'),amountBs:34.80}],[postpago],[],[]),/Selecciona una cuenta/);
});
