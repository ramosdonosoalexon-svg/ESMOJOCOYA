import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {shiftDateChange,suggestedOpening} from '../payload/operatorPilotUX.js';
import {operatorPilotValidation,compareAdjacentReadings} from '../payload/operatorPilotMath.js';
const home=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=name=>readFileSync(path.join(home,'payload',name),'utf8');
const today=new Date(2026,10,18,8,20);
const oneMeter={hoseId:'h1',hoseName:'Lado 1',productCode:'GE',meterTypes:['digital'],primary:'digital',digitalInitial:'100',digitalFinal:'105',priceBs:6.96};
const past={kind:'turno',date:'2026-11-17',startedAt:'',endedAt:'',readings:[oneMeter],allocations:[],payments:{}};
test('en fecha retroactiva no se requieren horas',()=>{
 assert.deepEqual(operatorPilotValidation(past,today),[]);
});
test('con fecha de hoy ambos horarios deben proceder automáticamente',()=>{
 const x={...past,date:'2026-11-18',startedAt:'2026-11-18T08:00'};
 assert.match(operatorPilotValidation(x,today).join(' '),/horario autom/);
 assert.deepEqual(operatorPilotValidation({...x,endedAt:'2026-11-18T08:20'},today),[]);
});
test('pasar de hoy a fecha retroactiva limpia ambas horas',()=>{
 const x=shiftDateChange({...past,date:'2026-11-18',startedAt:'2026-11-18T08:00',endedAt:'2026-11-18T08:10'},'2026-11-12','2026-11-18');
 assert.equal(x.date,'2026-11-12');assert.equal(x.startedAt,'');assert.equal(x.endedAt,'');
});
test('volver a hoy marca inicio automatico, no final',()=>{
 const x=shiftDateChange(past,'2026-11-18','2026-11-18');
 assert.match(x.startedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
 assert.equal(x.endedAt,'');
});
test('si la fecha no cambia no sobreescribe la hora',()=>{
 const x=shiftDateChange({...past,date:'2026-11-18',startedAt:'2026-11-18T07:59'},'2026-11-18','2026-11-18');
 assert.equal(x.startedAt,'2026-11-18T07:59');
});
test('último cierre de ayer con fecha sin hora puede sugerirse para hoy',()=>{
 const x=suggestedOpening({hoseId:'h1',meterType:'digital',at:'2026-11-18T08:00',events:[{hoseId:'h1',meterType:'digital',phase:'final',reading:105,observedAt:'2026-11-17'}]});
 assert.equal(x.value,'105');
});
test('no confunde dos eventos sin hora del mismo día como una entrega de turno',()=>{
 const x=compareAdjacentReadings([{id:'a',shiftId:'a',operatorUid:'u1',hoseId:'h1',phase:'final',reading:105,observedAt:'2026-11-17'},{id:'b',shiftId:'b',operatorUid:'u2',hoseId:'h1',phase:'inicio',reading:105,observedAt:'2026-11-17'}],'h1');
 assert.deepEqual(x,[]);
});
test('no inventa orden dentro del mismo día retroactivo',()=>{
 const x=suggestedOpening({hoseId:'h1',meterType:'digital',at:'2026-11-17T23:59',events:[{hoseId:'h1',meterType:'digital',phase:'final',reading:105,observedAt:'2026-11-17'}]});
 assert.equal(x.value,'');
});
test('se eliminó el formulario de horas retroactivas sin bloquear selección 3D o lista',()=>{
 const src=read('OperatorPilot.jsx');
 assert.doesNotMatch(src,/Inicio \(retroactivo\)|Fin \(retroactivo\)|Indica primero la hora de inicio/);
 assert.match(src,/entry\.date===clockDate\(\)\?\{\.\.\.entry,endedAt:localTime\(\)\}/);
 assert.doesNotMatch(src,/disabled=\{isHistorical&&entry\.kind==='turno'&&\!entry\.startedAt\}/);
});
test('eventos retroactivos guardan fecha, no hora inventada',()=>{
 const src=read('operatorPilotData.js');
 assert.match(src,/const observedAt=stamp\|\|\(entry\.kind==='turno'\?entry\.date:''\)/);
 assert.match(src,/observedAt,day:entry\.date/);
});
