import test from 'node:test';
import assert from 'node:assert/strict';
import {isSundayISO} from '../src/reportCalendar.js';
test('Marca los domingos reales, sin afectar la fecha de operación',()=>{
 assert.equal(isSundayISO('2026-11-08'),true);
 assert.equal(isSundayISO('2026-11-01'),true);
 assert.equal(isSundayISO('2026-11-09'),false);
 assert.equal(isSundayISO('2026-11-07'),false);
});
test('Rechaza fechas inválidas y valores vacíos',()=>{
 assert.equal(isSundayISO('2026-02-30'),false);
 assert.equal(isSundayISO(null),false);
 assert.equal(isSundayISO(''),false);
});
