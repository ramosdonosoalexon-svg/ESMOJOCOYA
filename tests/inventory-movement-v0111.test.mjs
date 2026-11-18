import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {gasolineReceiptsByDate,GAS_COLOR} from '../src/gasolineVisual.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=n=>readFileSync(resolve(root,'src',n),'utf8');

test('Inventarios no utiliza una variable de tanque fuera del mapa en Total físico',()=>{
  const source=file('Operations.jsx');
  const start=source.indexOf('<tr className="ivs-total-row">');
  assert.notEqual(start,-1,'debe existir la fila Total físico');
  const row=source.slice(start,source.indexOf('</tr>',start)+5);
  assert.match(row,/dualGas&&product==='GE'/);
  assert.doesNotMatch(row,/isGasoline\(t\.productCode\)/,
    'la fila de totales no tiene una variable t (solo existe dentro de selected.map)');
});

test('Movimientos presenta una cifra por saldo y mantiene el detalle en el ojo',()=>{
  const jsx=file('MovementBook.jsx');
  assert.match(jsx,/c\.key==='physical'\?compactBalance\(value,dayMix\)/);
  assert.match(jsx,/c\.key==='beginning'\?compactBalance\(value,beforeMix\)/);
  assert.match(jsx,/c\.key==='receiptL'\?compactReceipt\(receipt,value\)/);
  assert.doesNotMatch(jsx,/<div className="gfv-mini"/);
  assert.match(jsx,/className="gfv-eye"/);
  assert.match(jsx,/openDay===r\.date/);
  assert.match(file('movement.css'),/\.gfv-ledger td\{white-space:nowrap/);
});

test('Colores GE, GE+ y mezcla se mantienen distintos de mermas y demasías',()=>{
  assert.equal(GAS_COLOR.GE,'#263238');
  assert.equal(GAS_COLOR.GE_PLUS,'#89502b');
  assert.equal(GAS_COLOR.BLEND,'#d58b33');
});

test('Dos recepciones GE+ permanecen diferenciadas por fecha',()=>{
  const values=gasolineReceiptsByDate([
    {date:'2026-11-09',productCode:'GE_PLUS',documentLiters:12000},
    {date:'2026-11-10',productCode:'GE_PLUS',documentLiters:10000}
  ]);
  assert.equal(values.get('2026-11-09').GE_PLUS,12000);
  assert.equal(values.get('2026-11-10').GE_PLUS,10000);
});
