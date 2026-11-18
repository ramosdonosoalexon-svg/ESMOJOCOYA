import test from 'node:test';
import assert from 'node:assert/strict';
import {computeGnvBridge,bridgeInitialForDate} from '../src/gnvBridgeMath.js';
import {openingMeterValue,activeGasolineProduct,nextMeterInitial} from '../src/meterMath.js';
const bridge={manual:{initial:302833.34,final:302922.72},corrected:{initial:4784793,final:4786346},uncorrected:{initial:302832,final:302922}};
test('la matriz GNV separa manual, corregido y no corregido',()=>{
 const result=computeGnvBridge(bridge);
 assert.equal(result.receivedManual,89.38);
 assert.equal(result.receivedCorrected,1553);
 assert.equal(result.receivedUncorrected,90);
 assert.equal(result.uncorrectedConvertedM3,2548.531);
});
test('una lectura final menor que la inicial del puente se rechaza',()=>assert.throws(()=>computeGnvBridge({...bridge,manual:{initial:10,final:9}}),/menor/));
test('el puente inicia desde Datos iniciales aunque el registro sea días después',()=>{
 const data={readings:{manual:10,corrected:20,uncorrected:30}};
 assert.equal(bridgeInitialForDate([],'2026-11-10','manual',data),10);
});
test('el puente continúa con la lectura final del día anterior',()=>{
 const existing=[{date:'2026-11-08',readings:{manual:{initial:10,final:14}}}];
 assert.equal(bridgeInitialForDate(existing,'2026-11-09','manual',{readings:{manual:8}}),14);
});
test('meters líquidos usan inicial real incluso después de la fecha de arranque',()=>{
 assert.equal(openingMeterValue([],'2026-11-09','hose-1','mecanico',[{hoseId:'hose-1',readings:{mecanico:702000}}],'2026-11-01'),702000);
});
test('último arqueo supera el dato inicial',()=>{
 const rows=[{date:'2026-11-06',status:'vigente',hoseId:'hose-1',sequence:0,readings:{mecanico:{initial:702000,final:703000}}}];
 assert.equal(openingMeterValue(rows,'2026-11-07','hose-1','mecanico',[{hoseId:'hose-1',readings:{mecanico:702000}}],'2026-11-01'),703000);
});
test('la selección de gasolina cambia de GE a GE+ sin reiniciar el meter',()=>{
 const hose={id:'manguera',productCode:'GE'};
 const shifts=[{date:'2026-11-08',shiftTime:'11:00',status:'vigente',hoseId:'manguera',sequence:0,productCode:'GE_PLUS',readings:{mecanico:{final:300}}}];
 assert.equal(activeGasolineProduct(hose,'2026-11-08',shifts,['GE','GE_PLUS']),'GE_PLUS');
 assert.equal(nextMeterInitial(shifts,'2026-11-09','manguera','mecanico'),300);
});
