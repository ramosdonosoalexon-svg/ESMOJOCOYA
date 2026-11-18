import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveHoseProductCode,resolveLegacyHoses} from '../src/hoseCompat.js';
import {compatibleHoseProduct,openingMeterValue,computeMeterShift} from '../src/meterMath.js';
const tanks=[{id:'tk2',name:'TK2',productCode:'GE'}];
const legacy=[{id:'g1',name:'G-1',active:true,dispenserId:'d1',feedTankIds:['tk2'],meterTypes:['mecanico','digital']},{id:'g2',name:'G-2',active:true,dispenserId:'d1',feedTankIds:['tk2'],meterTypes:['mecanico','digital']}];
test('mangueras creadas antes de v0.4 heredan temporalmente producto del TK2',()=>{
  assert.equal(resolveHoseProductCode(legacy[0],tanks),'GE');
  const resolved=resolveLegacyHoses(legacy,tanks);
  assert.equal(resolved.filter(h=>h.active!==false&&compatibleHoseProduct(h.productCode,'GE')).length,2);
  assert.equal(resolved.filter(h=>h.active!==false&&compatibleHoseProduct(h.productCode,'GE_PLUS')).length,2);
  assert.equal(legacy[0].productCode,undefined);
});
test('mangueras nuevas conservan su producto y no se reescriben',()=>{
  const direct={id:'h',productCode:'D_ULS',feedTankIds:['tk2']};
  assert.equal(resolveLegacyHoses([direct],tanks)[0],direct);
  assert.equal(resolveHoseProductCode(direct,tanks),'D_ULS');
});
test('lecturas iniciales mecánica y digital continúan con los IDs antiguos',()=>{
  const initialMeters=[{hoseId:'g1',readings:{mecanico:1,digital:1}}];
  assert.equal(openingMeterValue([],'2026-11-08','g1','mecanico',initialMeters,'2026-11-01'),1);
  assert.equal(openingMeterValue([],'2026-11-08','g1','digital',initialMeters,'2026-11-01'),1);
});
test('registro de GE conserva las lecturas iniciales y el producto de la manguera recuperada',()=>{
  const hose=resolveLegacyHoses(legacy,tanks)[0];
  const shift=computeMeterShift({date:'2026-11-08',shiftTime:'08:00',hose,productCode:'GE',readings:{mecanico:{initial:1,final:11},digital:{initial:1,final:11}},primary:'mecanico',allocations:[{concept:'venta',volume:10}],priceHistory:[{productCode:'GE',effectiveDate:'2026-11-08',effectiveTime:'00:00',priceBs:6.96}]});
  assert.equal(shift.grossVolume,10);
  assert.equal(shift.hoseId,'g1');
});
test('manguera sin tanque válido queda identificable sin datos inventados',()=>{
  const broken={id:'x',name:'G-x',feedTankIds:['missing']};
  assert.equal(resolveHoseProductCode(broken,tanks),null);
  assert.equal(resolveLegacyHoses([broken],tanks)[0],broken);
});
