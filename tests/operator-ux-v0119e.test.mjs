import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestedOpening,shiftDateChange,parseInvoiceQR,operativeDate} from '../src/operatorPilotUX.js';

const cuf='A1B2'.repeat(16);
test('prefiere el último final del piloto a la base anterior',()=>{
 const x=suggestedOpening({hoseId:'h1',meterType:'mecanico',at:'2026-11-15T10:00',initialMeters:[{hoseId:'h1',readings:{mecanico:100}}],events:[{id:'p',hoseId:'h1',meterType:'mecanico',phase:'final',reading:150,observedAt:'2026-11-14T19:00'},{id:'f',hoseId:'h1',meterType:'mecanico',phase:'final',reading:999,observedAt:'2026-11-16T19:00'}]});
 assert.equal(x.value,'150');assert.equal(x.source,'Último arqueo piloto');
});
test('no usa lecturas posteriores en fechas históricas',()=>{
 const x=suggestedOpening({hoseId:'h1',meterType:'digital',at:'2026-11-02T12:00',initialMeters:[{hoseId:'h1',readings:{digital:40}}],events:[{hoseId:'h1',meterType:'digital',phase:'final',reading:80,observedAt:'2026-11-03T13:00'}]});
 assert.equal(x.value,'40');assert.equal(x.source,'Dato inicial');
});
test('no inventa un inicial ausente',()=>{
 assert.deepEqual(suggestedOpening({hoseId:'h1',meterType:'digital',at:'2026-11-02T12:00'}),{value:'',source:'Sin lectura anterior',observedAt:null});
});
test('cortes de medianoche pueden ser la última lectura disponible',()=>{
 const x=suggestedOpening({hoseId:'h1',meterType:'mecanico',at:'2026-11-16T09:00',events:[{hoseId:'h1',meterType:'mecanico',phase:'medianoche',reading:333,observedAt:'2026-11-16T00:02'}]});
 assert.equal(x.value,'333');assert.equal(x.source,'Corte anterior');
});
test('URL SIAT actual extrae NIT CUF y factura sin inferir litros',()=>{
 const x=parseInvoiceQR(`https://siat.impuestos.gob.bo/consulta/QR?nit=1234567&cuf=${cuf}&numero=43&t=2`);
 assert.equal(x.issuerNit,'1234567');assert.equal(x.invoiceNumber,'43');assert.equal(x.cuf,cuf);assert.equal(x.volume,undefined);assert.equal(x.customer,undefined);
});
test('URL antigua var1 CUF, var2 NIT, var3 factura',()=>{
 const x=parseInvoiceQR(`https://impuestos.gob.bo/test?var1=${cuf}&var2=4567890&var3=101`);
 assert.equal(x.invoiceNumber,'101');assert.equal(x.issuerNit,'4567890');
});
test('rechaza enlaces sin identidad fiscal',()=>{
 assert.throws(()=>parseInvoiceQR('https://sitio.com/pago?secret=123'),/faltan NIT, CUF/);
});
test('fecha histórica borra hora tomada hoy y no permite mañana',()=>{
 const entry={date:operativeDate(),startedAt:operativeDate()+'T07:30',endedAt:''};
 const x=shiftDateChange(entry,'2026-11-01');
 assert.equal(x.startedAt,'');assert.equal(x.endedAt,'');
 assert.throws(()=>shiftDateChange(entry,'2099-11-19'),/Fecha posterior/);
});
