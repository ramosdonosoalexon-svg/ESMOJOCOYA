import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gnvDailyIndicator,gnvMonthlySummary} from '../src/gnvRiskMath.js';

const examples=[
 {date:'2026-11-01',receivedCorrected:5815,outVolume:5646.41,hasActivity:true},
 {date:'2026-11-02',receivedCorrected:5917,outVolume:5776.79,hasActivity:true},
 {date:'2026-11-03',receivedCorrected:5762,outVolume:5638.40,hasActivity:true}
];
test('01/11 muestra merma diaria -168,59 m³ y -2,90 %, no demasía',()=>{
 const x=gnvDailyIndicator(examples[0]);
 assert.equal(x.state,'merma');assert.equal(x.signed,-168.59);
 assert.ok(Math.abs(x.percent-(-2.8992))<0.0001);
 assert.equal(x.lossM3,168.59);assert.equal(x.surplusM3,0);
 assert.equal(x.surplusPercent,0);
});
test('02/11 y 03/11 son mermas -140,21 y -123,60 m³',()=>{
 const a=gnvDailyIndicator(examples[1]);const b=gnvDailyIndicator(examples[2]);
 assert.equal(a.signed,-140.21);assert.equal(b.signed,-123.6);
 assert.ok(a.lossPercent>2.36&&a.lossPercent<2.38);
 assert.ok(b.lossPercent>2.14&&b.lossPercent<2.15);
});
test('diferencia positiva se identifica como demasía, sin merma',()=>{
 const x=gnvDailyIndicator({receivedCorrected:1000,outVolume:1050});
 assert.equal(x.state,'demasia');assert.equal(x.signed,50);
 assert.equal(x.percent,5);assert.equal(x.surplusM3,50);assert.equal(x.lossM3,0);
});
test('cierre sin diferencia se mantiene neutral',()=>{
 const x=gnvDailyIndicator({receivedCorrected:1000,outVolume:1000});
 assert.equal(x.state,'igual');assert.equal(x.percent,0);
});
test('faltan PRM o meters: pendiente, no se inventan valores ni porcentajes',()=>{
 const noPrm=gnvDailyIndicator({receivedCorrected:null,outVolume:5646.41});
 const noMeter=gnvDailyIndicator({receivedCorrected:5815,outVolume:null});
 for(const x of [noPrm,noMeter]){
   assert.equal(x.state,'pendiente');assert.equal(x.signed,null);assert.equal(x.percent,null);
   assert.equal(x.lossM3,null);assert.equal(x.surplusM3,null);
 }
});
test('sumatoria diaria coincide con la diferencia mensual del tablero',()=>{
 const rows=examples.map(r=>({...r,...(() => {const d=gnvDailyIndicator(r);return {signedDifference:d.signed,differencePercent:d.percent};})()}));
 const monthly=gnvMonthlySummary(rows,'2026-11');
 const sum=rows.reduce((n,r)=>n+gnvDailyIndicator(r).signed,0);
 assert.ok(Math.abs(sum-monthly.signed)<0.00001);
 assert.equal(monthly.signed,-432.4);
 assert.equal(monthly.lossRatePct>2.47&&monthly.lossRatePct<2.48,true);
});
test('Control diario va encima de la matriz extensa y sin depender del scroll horizontal',()=>{
 const jsx=readFileSync(new URL('../src/MovementBook.jsx',import.meta.url),'utf8');
 const mini=jsx.indexOf('className="gnv-daily-panel"');
 const matrix=jsx.indexOf('className="movement-scroll"><table className="movement-table gnv-matrix-table"');
 assert.ok(mini>0&&matrix>mini);
 assert.ok(jsx.includes('gnvDailyIndicator(r)'));
 const css=readFileSync(new URL('../src/movement.css',import.meta.url),'utf8');
 assert.ok(css.includes('.gnv-daily-table'));
 assert.ok(css.includes('@media(max-width:720px)'));
});
