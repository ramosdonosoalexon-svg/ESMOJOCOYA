import test from 'node:test';
import assert from 'node:assert/strict';
import { productOptions } from '../src/receptionProductOptions.js';

test('Cambio GE a GE+ permite abrir detalle sin lista de habilitados', () => {
  assert.deepEqual(productOptions({ productCode: 'GE' }), ['GE', 'GE_PLUS']);
});

test('Cambio GE+ a GE permite ver el producto previo', () => {
  assert.deepEqual(productOptions({ productCode: 'GE_PLUS' }), ['GE', 'GE_PLUS']);
});

test('Producto recibido solo puede elegirse entre habilitados', () => {
  assert.deepEqual(productOptions({ productCode: 'GE' }, ['GE_PLUS']), ['GE_PLUS']);
  assert.deepEqual(productOptions({ productCode: 'GE' }, ['GE']), ['GE']);
});

test('Diésel usa la misma regla de familia', () => {
  assert.deepEqual(productOptions({ productCode: 'DO' }), ['DO', 'D_ULS']);
  assert.deepEqual(productOptions({ productCode: 'D_ULS' }, ['D_ULS']), ['D_ULS']);
});

test('Ningún tanque devuelve opciones vacías', () => {
  assert.deepEqual(productOptions(null), []);
});
