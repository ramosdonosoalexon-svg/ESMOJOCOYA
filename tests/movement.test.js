import test from 'node:test';
import assert from 'node:assert/strict';
import {boliviaCurrentMonth,monthDays,changeMonth,buildLiquidMovements,buildGnvMovements,visibleMovementColumns} from '../src/movementMath.js';
const p=[{code:'GE',active:true},{code:'GE_PLUS',active:true},{code:'DO',active:true},{code:'GNV',active:true}];
const t=[{id:'t1',name:'TK1',productCode:'GE',active:true},{id:'t2',name:'TK2',productCode:'DO',active:true}];
const initial=[{tankId:'t1',productCode:'GE',accountingLiters:1000,physicalLiters:1000},{tankId:'t2',productCode:'DO',accountingLiters:600,physicalLiters:600}];
const common={products:p,tanks:t,initialTanks:initial,initialDate:'2026-10-31'};
const day=date=>date==='2026-11-01';
test('Mes actual en Bolivia y cambio de mes independientes',()=>{
 assert.equal(boliviaCurrentMonth(new Date('2026-11-01T02:00:00Z')),'2026-10');
 assert.equal(boliviaCurrentMonth(new Date('2026-11-08T15:00:00Z')),'2026-11');
 assert.equal(monthDays('2026-02').length,28);
 assert.equal(monthDays('2028-02').length,29);
 assert.equal(changeMonth('2026-12',1),'2027-01');
 assert.equal(changeMonth('2026-01',-1),'2025-12');
});
test('No inventar columnas sin datos',()=>{
 const cols=visibleMovementColumns([{date:'2026-11-02',beginning:null,otherIncomeL:null}], [{key:'beginning'},{key:'otherIncomeL'}]);
 assert.deepEqual(cols,[]);
});
test('Saldo contable de cada producto conserva su arrastre separado, con tanque compartido',()=>{
 const result=buildLiquidMovements({...common,month:'2026-11',receptions:[{date:'2026-11-01',productCode:'GE_PLUS',documentLiters:500,otherIncomeLiters:0,status:'vigente',transportDifferenceL:-10,quality:'provisional'}],meterShifts:[{date:'2026-11-01',productCode:'GE',grossVolume:200,netTankOutVolume:200,returnedVolume:0,status:'vigente'}, {date:'2026-11-01',productCode:'GE_PLUS',grossVolume:100,netTankOutVolume:100,returnedVolume:0,status:'vigente'}],inventoryReadings:[{date:'2026-11-01',tankId:'t1',volumeLiters:1190}]});
 const ge=result.products.GE[0],plus=result.products.GE_PLUS[0];
 assert.equal(ge.beginning,1000);assert.equal(ge.closing,800);
 assert.equal(plus.beginning,0);assert.equal(plus.closing,400);
 assert.equal(plus.transportDiff,-10);
 assert.equal(ge.physical,null);assert.equal(plus.physical,null);
 const group=result.families.gasolina[0];assert.equal(group.physical,1190);assert.equal(group.accounting,1200);
 assert.equal(group.totalDiff,-10);assert.equal(group.operationDiff,0);
});
test('Merma de operación separada de transporte con producto único',()=>{
 const only=[{code:'DO',active:true}];
 const x=buildLiquidMovements({...common,products:only,month:'2026-11',receptions:[{date:'2026-11-01',productCode:'DO',documentLiters:400,transportDifferenceL:-10,status:'vigente',quality:'verificable_con_meters'}],meterShifts:[{date:'2026-11-01',productCode:'DO',netTankOutVolume:200,grossVolume:220,returnedVolume:20,status:'vigente'}],inventoryReadings:[{date:'2026-11-01',tankId:'t2',volumeLiters:785}]});
 const row=x.products.DO[0];assert.equal(row.beginning,600);assert.equal(row.closing,800);assert.equal(row.physical,785);assert.equal(row.operationDiff,-5);assert.equal(row.transportDiff,-10);
});
test('Se conserva saldo de octubre cuando se abre noviembre',()=>{
 const x=buildLiquidMovements({...common,month:'2026-11',meterShifts:[{date:'2026-10-31',productCode:'DO',netTankOutVolume:50,grossVolume:50,returnedVolume:0,status:'vigente'},{date:'2026-11-01',productCode:'DO',netTankOutVolume:20,grossVolume:20,returnedVolume:0,status:'vigente'}]});
 assert.equal(x.products.DO[0].beginning,550);assert.equal(x.products.DO[0].closing,530);
});
test('Anulados no participan y días futuros permanecen sin datos',()=>{
 const x=buildLiquidMovements({...common,month:'2026-11',meterShifts:[{date:'2026-11-01',productCode:'GE',netTankOutVolume:300,status:'anulada'}]});
 assert.equal(x.products.GE[1].hasActivity,false);assert.equal(x.products.GE[1].closing,null);
});
test('GNV: puente corregido frente a dispenser, sin llamar merma física al resultado',()=>{
 const result=buildGnvMovements({month:'2026-11',bridge:[{date:'2026-11-01',readings:{corrected:{volume:50}},receivedManual:52,receivedCorrected:50,receivedUncorrected:60,status:'vigente'}],meterShifts:[{date:'2026-11-01',productCode:'GNV',grossVolume:49,amountBs:100,status:'vigente'}]});
 assert.equal(result[0].receivedCorrected,50);assert.equal(result[0].outVolume,49);assert.equal(result[0].technicalDifference,1);
 assert.equal(result[2].hasActivity,false);
});
