import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGnvMovements,monthDays} from '../src/movementMath.js';
import {classifyGnvShifts,gnvDailyVariance,gnvMonthlySummary,compareGnvMonthlyRisk} from '../src/gnvRiskMath.js';
const makeBridge=(date,manual,corrected,uncorrected)=>({date,status:'vigente',readings:{corrected:{initial:0,final:corrected}},receivedManual:manual,receivedCorrected:corrected,receivedUncorrected:uncorrected});
const makeShift=(date,gross,lines=[{concept:'venta',volume:gross}])=>({date,productCode:'GNV',status:'vigente',grossVolume:gross,amountBs:gross*2.73,movementLines:lines});
const rows=buildGnvMovements({month:'2026-11',bridge:[
 makeBridge('2026-11-01',40490,5815,405),makeBridge('2026-11-02',41319,5917,413),makeBridge('2026-11-03',40258,5762,403)
],meterShifts:[
 makeShift('2026-11-01',5646.41),makeShift('2026-11-02',5776.79),makeShift('2026-11-03',5638.40)
]});
test('Matriz GNV 01/11 representa merma con signo negativo y en porcentaje',()=>{
 assert.equal(rows[0].receivedCorrected,5815);
 assert.equal(rows[0].signedDifference,-168.59);
 assert.ok(Math.abs(rows[0].differencePercent-(-2.8992))<0.0001);
 // legado de compatibilidad, no usar para la matriz:
 assert.equal(rows[0].technicalDifference,168.59);
});
test('Matriz GNV del 02/11 y 03/11 concuerda con signo de Excel',()=>{
 assert.equal(rows[1].signedDifference,-140.21);
 assert.equal(rows[2].signedDifference,-123.6);
 assert.equal(rows[1].receivedManual,41319);
});
test('No contar el detalle del meter como otra salida adicional',()=>{
 const x=classifyGnvShifts([makeShift('2026-11-01',584.91,[
  {concept:'prepago',volume:300},{concept:'postpago',volume:10}
 ])]);
 assert.equal(x.categories.prepago,300);
 assert.equal(x.categories.postpago,10);
 assert.equal(x.categories.contado,274.91);
 assert.ok(Math.abs(Object.values(x.categories).reduce((a,b)=>a+b,0)-584.91)<0.0001);
});
test('GNV desglosa calibración, consumo propio y otros sin duplicación',()=>{
 const x=classifyGnvShifts([makeShift('2026-11-01',85,[
  {concept:'consumo_propio',volume:20},{concept:'calibracion_venta',volume:5},{concept:'limpieza',volume:10},
  {concept:'prepago',volume:15},{concept:'postpago',volume:15},{concept:'venta',volume:20}
 ])]);
 assert.equal(x.categories.consumoPropio,20);
 assert.equal(x.categories.calibracion,5);
 assert.equal(x.categories.otros,10);
 assert.equal(x.categories.prepago,15);
 assert.equal(x.categories.postpago,15);
 assert.equal(x.categories.contado,20);
});
test('Desglose histórico mayor que meter queda sin clasificar y se avisa',()=>{
 const x=classifyGnvShifts([makeShift('2026-11-01',20,[{concept:'prepago',volume:50}])]);
 assert.equal(x.categories.sinClasificar,20);
 assert.equal(x.categories.prepago,0);
 assert.equal(x.problems.length,1);
});
test('Anulados no se suman ni se clasifican',()=>{
 const x=classifyGnvShifts([{...makeShift('2026-11-01',123),status:'anulada'}]);
 assert.equal(Object.values(x.categories).reduce((a,b)=>a+b,0),0);
});
test('GNV demasía positiva es otro signo',()=>{
 const out=gnvDailyVariance(1000,1050);
 assert.equal(out.signed,50);assert.equal(out.percent,5);assert.equal(out.loss,0);assert.equal(out.surplus,50);
});
test('GNV sin medidores no se convierte en cero falso',()=>{
 const out=gnvDailyVariance(null,0);
 assert.equal(out.signed,null);assert.equal(out.percent,null);
});
test('Promedio mensual ponderado de PRM frente a meters',()=>{
 const sum=gnvMonthlySummary(rows,'2026-11');
 assert.equal(sum.observedDays,3);assert.equal(sum.totalDays,30);assert.equal(sum.complete,false);
 assert.equal(sum.corrected,17494);assert.equal(sum.dispensed,17061.6);
 assert.equal(sum.loss,432.4);
 assert.ok(Math.abs(sum.lossRatePct-2.4717)<0.0002);
});
test('Sin todos los días de octubre no se inventa referencia',()=>{
 const prev=gnvMonthlySummary([{date:'2026-10-31',receivedCorrected:100,outVolume:95,signedDifference:-5,differencePercent:-5}],'2026-10');
 const cur=gnvMonthlySummary(rows,'2026-11');
 assert.equal(compareGnvMonthlyRisk(cur,prev).status,'sin_referencia');
});
test('Un mes cerrado se convierte en referencia del siguiente',()=>{
 const previous=monthDays('2026-10').map(date=>({date,receivedCorrected:1000,outVolume:970,signedDifference:-30,differencePercent:-3}));
 const prev=gnvMonthlySummary(previous,'2026-10');
 assert.equal(prev.complete,true);assert.equal(prev.lossRatePct,3);
 const within=gnvMonthlySummary([{date:'2026-11-01',receivedCorrected:1000,outVolume:967,signedDifference:-33,differencePercent:-3.3}],'2026-11');
 assert.equal(compareGnvMonthlyRisk(within,prev).status,'superior');
 const danger=gnvMonthlySummary([{date:'2026-11-01',receivedCorrected:1000,outVolume:966,signedDifference:-34,differencePercent:-3.4}],'2026-11');
 assert.equal(compareGnvMonthlyRisk(danger,prev).status,'critico');
 assert.equal(compareGnvMonthlyRisk(danger,prev).threshold,3.3);
});
test('Sin referencia base positiva no calcular incremento infinito',()=>{
 assert.equal(compareGnvMonthlyRisk({observedDays:1,lossRatePct:2},{complete:true,lossRatePct:0}).status,'referencia_cero');
});
test('Demasías mensuales se reportan por separado de mermas',()=>{
 const r=gnvMonthlySummary([
  {date:'2026-11-01',receivedCorrected:1000,outVolume:1050,signedDifference:50,differencePercent:5},
  {date:'2026-11-02',receivedCorrected:1000,outVolume:980,signedDifference:-20,differencePercent:-2}
 ],'2026-11');
 assert.equal(r.lossRatePct,1);assert.equal(r.surplusRatePct,2.5);
 assert.equal(r.signed,30);
});
