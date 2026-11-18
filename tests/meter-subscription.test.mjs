import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const meterBook = readFileSync(new URL('../src/MeterBook.jsx',import.meta.url), 'utf8');
const hook = readFileSync(new URL('../src/hooks.js',import.meta.url), 'utf8');

// Regression for the exact condition in useDocuments: deps.some(x => !x).
test('el libro de meters no inicia una dependencia de consulta en cero', () => {
  assert.match(hook, /deps\.some\(x\s*=>\s*!x\)/);
  assert.match(meterBook, /\[refresh,setRefresh\]=useState\(1\)/);
  assert.match(meterBook, /\[stationId,date,refresh\]/);
  const stationId = 'estacion-prueba';
  const date = '2026-11-01';
  const refresh = 1;
  assert.equal([stationId,date,refresh].some(x => !x), false);
});

test('la consulta de meters incluye los arqueos históricos hasta fecha seleccionada', () => {
  assert.match(meterBook, /stationPath\(stationId,'meterShifts'\)/);
  assert.match(meterBook, /where\('date','<=',addDaysISO\(date,1\)\)/);
});
