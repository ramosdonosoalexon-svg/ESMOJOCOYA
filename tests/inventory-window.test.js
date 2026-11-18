import test from 'node:test';
import assert from 'node:assert/strict';
import {addDaysISO,inventoryWindow,nextInventoryDate,latestReadingsByTank} from '../src/inventoryWindow.js';
test('ventana 5 previos, activo, 3 siguientes atravesando el cambio de mes',()=>{
  const dates=inventoryWindow('2026-11-01');
  assert.equal(dates.length,9);
  assert.equal(dates[0],'2026-10-27');
  assert.equal(dates[5],'2026-11-01');
  assert.equal(dates[8],'2026-11-04');
  assert.equal(addDaysISO('2026-12-31',1),'2027-01-01');
});
test('primer día se toma de la fecha inicial, no del calendario real',()=>{
  assert.equal(nextInventoryDate([],[{id:'t1'}],'2026-11-01','2026-11-06'),'2026-11-01');
});
test('fecha avanza solo cuando todos los tanques del producto están medidos',()=>{
  const tanks=[{id:'t1'},{id:'t2'}];
  const a=[{tankId:'t1',date:'2026-11-01'}];
  assert.equal(nextInventoryDate(a,tanks,'2026-11-01','2026-11-06'),'2026-11-01');
  assert.equal(nextInventoryDate([...a,{tankId:'t2',date:'2026-11-01'}],tanks,'2026-11-01','2026-11-06'),'2026-11-02');
  assert.equal(nextInventoryDate([...a,{tankId:'t2',date:'2026-11-01'},{tankId:'otro',date:'2026-11-02'}],tanks,'2026-11-01','2026-11-06'),'2026-11-02');
});
test('no mezcla lecturas de tanques inactivos y conserva última lectura por tanque',()=>{
  assert.equal(nextInventoryDate([{tankId:'t1',date:'2026-11-02'}],[{id:'t1'},{id:'t2',active:false}],'2026-11-01','2026-11-06'),'2026-11-03');
  const map=latestReadingsByTank([{tankId:'t1',date:'2026-11-01',volumeLiters:100},{tankId:'t1',date:'2026-11-03',volumeLiters:80}]);
  assert.equal(map.get('t1').volumeLiters,80);
});
