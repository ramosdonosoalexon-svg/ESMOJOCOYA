import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateReception,calculateMeterLine,sameFamily,familyProducts} from '../src/receptionMath.js';
const args={startVolumeL:22091,endVolumeL:53216,documentLiters:31500};
test('Matriz Ostria: 31500 documentados y 31125 físicos genera -375 L transporte',()=>{
  const r=calculateReception(args);
  assert.equal(r.physicalReceivedL,31125);
  assert.equal(r.transportDifferenceL,-375);
  assert.equal(r.quality,'provisional');
});
test('Una descarga con ventas simultáneas incorpora los meters para aislar ingreso',()=>{
 const r=calculateReception({...args,meterMode:'meters',meterCoverageComplete:true,meterRows:[
  {hoseId:'h1',hoseName:'H1',productCode:'GE',primary:'mecanico',shared:false,
   readings:{mecanico:{initial:10100,final:10500},digital:{initial:2000,final:2395}}}
 ]});
 assert.equal(r.salesDuringReceptionL,400);
 assert.equal(r.physicalReceivedL,31525);
 assert.equal(r.transportDifferenceL,25);
 assert.equal(r.meterLines[0].meterTotals.digital,395);
 assert.equal(r.quality,'verificable_con_meters');
});
test('No se suman meters mecánico y digital',()=>{
 const r=calculateMeterLine({hoseId:'x',primary:'digital',shared:false,
 readings:{mecanico:{initial:100,final:110},digital:{initial:200,final:212}}});
 assert.equal(r.liters,12);
});
test('Mangueras compartidas solo asignan volumen registrado al tanque',()=>{
 const r=calculateReception({...args,meterMode:'meters',meterCoverageComplete:false,meterRows:[
 {hoseId:'h1',primary:'digital',productCode:'GE',shared:true,allocatedLiters:55,readings:{digital:{initial:500,final:650}}}
 ]});
 assert.equal(r.salesDuringReceptionL,55);
 assert.equal(r.quality,'provisional');
});
test('Otros ingresos no se confunden con recepción de cisterna',()=>{
 const r=calculateReception({...args,otherIncomeLiters:125});
 assert.equal(r.transportDifferenceL,-500);
});
test('Producto cambia dentro de su familia sin atribuir volumen físico a composición',()=>{
 assert.equal(sameFamily('GE','GE_PLUS'),true);
 assert.equal(sameFamily('DO','D_ULS'),true);
 assert.equal(sameFamily('GE','DO'),false);
 assert.deepEqual(familyProducts('GE'),['GE','GE_PLUS']);
});
test('Se rechazan lecturas de meter regresivas y asignaciones imposibles',()=>{
 assert.throws(()=>calculateMeterLine({hoseId:'a',primary:'mecanico',readings:{mecanico:{initial:101,final:100}}}),/inválidas/);
 assert.throws(()=>calculateMeterLine({hoseId:'a',primary:'mecanico',shared:true,allocatedLiters:100,readings:{mecanico:{initial:100,final:110}}}),/atribuibles/);
});
test('Despachos etiquetados por producto se conservan para futura conciliación',()=>{
 const r=calculateReception({...args,meterMode:'meters',meterCoverageComplete:true,meterRows:[
  {hoseId:'h1',primary:'mecanico',productCode:'GE',readings:{mecanico:{initial:20,final:25}}},
  {hoseId:'h2',primary:'digital',productCode:'GE_PLUS',readings:{digital:{initial:30,final:37}}}
 ]});
 assert.deepEqual(r.salesByProductL,{GE:5,GE_PLUS:7});
 assert.equal(r.salesDuringReceptionL,12);
});
