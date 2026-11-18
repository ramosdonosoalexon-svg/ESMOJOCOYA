import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addDaysISO} from '../src/inventoryWindow.js';
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const meter=readFileSync(new URL('../src/MeterBook.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const meterCss=readFileSync(new URL('../src/meter.css',import.meta.url),'utf8');
test('la barra de módulos es fija sin perder scroll horizontal',()=>{
 assert.match(app,/className="tab-strip" aria-label="Módulos de la estación"/);
 assert.match(css,/\.tab-strip\{\s*position:sticky;top:0/);
 assert.match(css,/overflow-x:auto/);
 for (const id of ['inventory','receipts','meters','movements']) assert.ok(app.includes(`id:'${id}'`));
});
test('la fecha no se reinicia al cambiar de módulo',()=>{
 assert.match(app,/onOperationalDateChange=\{setMeterDate\}/);
 assert.match(meter,/const date=operationalDate\|\|localDate/);
 assert.match(meter,/onOperationalDateChange\?\.\(next\)/);
});
test('selector de fecha fijo y navegación rápida a combustible',()=>{
 assert.match(meterCss,/\.meter-book>\.meter-toolbar\{\s*position:sticky/);
 assert.match(meterCss,/top:var\(--station-sticky-tabs-height/);
 assert.match(meter,/aria-label="Día anterior"/);
 assert.match(meter,/aria-label="Día siguiente"/);
 assert.match(meter,/id=\{`meters-\$\{codes\[0\]\}`\}/);
 assert.match(meter,/scrollIntoView/);
 assert.equal(addDaysISO('2026-11-14',-1),'2026-11-13');
 assert.equal(addDaysISO('2026-11-14',1),'2026-11-15');
});
