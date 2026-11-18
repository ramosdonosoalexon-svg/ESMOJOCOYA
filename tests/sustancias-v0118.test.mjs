import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSustanciasPart1} from '../src/sustanciasModel.js';
import {readStoredZip,createSustanciasExcelBytes} from '../src/sustanciasTemplate.js';
const base=new URL('../public/templates/sustancias-controladas-parte1.xlsx',import.meta.url);
const template=fs.readFileSync(base);
const profile={registration:'TEST-123',legalName:'ESTACIÓN PRUEBA SRL',legalRepresentative:'REP PRUEBA',city:'ORURO',address:'DIR',responsible:'RESP'};
const period='2026-11';
const mkRows=(code)=>Array.from({length:30},(_,i)=>({date:`2026-11-${String(i+1).padStart(2,'0')}`,beginning:10000,receipt:i===8?12000:null,sale:100,plus:null,loss:null}));
const src={month:period,cutoff:'2026-11-30',active:['GE','GE_PLUS','DO'],provisional:false,
  liquids:Object.fromEntries(['GE','GE_PLUS','DO'].map(code=>[code,{rows:mkRows(code),pending:0}]))};
const receptions=[{date:'2026-11-09',productCode:'GE_PLUS',documentLiters:12000,supplier:'YPFB',documentNumber:'123'},{date:'2026-11-10',productCode:'GE_PLUS',documentLiters:10000,supplier:'YPFB',documentNumber:'124'}];
const meterShifts=Array.from({length:30},(_,i)=>({date:`2026-11-${String(i+1).padStart(2,'0')}`,status:'vigente',productCode:'GE',netTankOutVolume:10}));
const input={report:src,receptions,meterShifts,profile};
test('modelo de adquisiciones, ventas y faltantes',()=>{
 const m=buildSustanciasPart1(input);assert.equal(m.periods.GE_PLUS.purchases,22000);
 assert.equal(m.periods.GE.out,300);assert.equal(m.periods.GE.sales.length,30);
 assert.ok(m.problems.some(x=>x.includes('facturas individuales')));
});
test('plantilla conserva siete hojas, formato y archivos gráficos',()=>{
 const zip=readStoredZip(template);
 assert.ok(zip.has('xl/worksheets/sheet7.xml'));
 assert.ok(zip.has('xl/styles.xml'));
 assert.ok([...zip.keys()].some(x=>x.startsWith('xl/media/')));
});
test('reemplaza datos de muestra, mes y amplía tabla de ventas GE a 30 días',()=>{
 const report=buildSustanciasPart1(input),result=createSustanciasExcelBytes(report,template);
 const files=readStoredZip(result);
 const ge=new TextDecoder().decode(files.get('xl/worksheets/sheet7.xml'));
 assert.match(ge,/r="A39"/);assert.match(ge,/r="C39"[^>]*><v>10<\/v>/);
 assert.match(ge,/SUM\(C10:C39\)/);
 const ventasDO=new TextDecoder().decode(files.get('xl/worksheets/sheet4.xml'));
 assert.doesNotMatch(ventasDO,/AGOSTO/);
 const adq=new TextDecoder().decode(files.get('xl/worksheets/sheet6.xml'));
 assert.match(adq,/22000/);
 assert.equal(files.size,readStoredZip(template).size);
 // La exportación se valida en memoria, también en Windows.
});
test('más recepciones que filas del modelo: no recorta datos y actualiza fórmulas del resumen',()=>{
 const receptions=[...Array.from({length:15},(_,i)=>({date:`2026-11-${String(1+i%20).padStart(2,'0')}`,productCode:'GE',documentLiters:1000,supplier:'YPFB'})),
    ...Array.from({length:30},(_,i)=>({date:`2026-11-${String(1+i%20).padStart(2,'0')}`,productCode:'DO',documentLiters:1200,supplier:'YPFB'}))];
 const m=buildSustanciasPart1({...input,receptions});const zip=readStoredZip(createSustanciasExcelBytes(m,template));
 const ge=new TextDecoder().decode(zip.get('xl/worksheets/sheet2.xml'));
 const dox=new TextDecoder().decode(zip.get('xl/worksheets/sheet3.xml'));
 const summary=new TextDecoder().decode(zip.get('xl/worksheets/sheet1.xml'));
 assert.match(ge,/SUM\(B16:B30\)/);assert.match(dox,/SUM\(C16:C45\)/);
 assert.match(summary,/'DETALLE ADQ. GE'!F45/);
 assert.match(summary,/'DETALLE ADQ. DO'!G60/);
});
