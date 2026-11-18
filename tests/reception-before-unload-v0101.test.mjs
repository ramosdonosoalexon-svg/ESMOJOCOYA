import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateReception} from '../src/receptionMath.js';

const read=()=>readFileSync(new URL('../src/ReceptionBook.jsx',import.meta.url),'utf8');

test('La recepción usa el volumen FÍSICO antes de descargar, sin descontar otra vez ventas anteriores',()=>{
 const r=calculateReception({startVolumeL:17119,endVolumeL:34500,documentLiters:17381,otherIncomeLiters:0});
 assert.equal(r.physicalIncreaseL,17381);
 assert.equal(r.physicalReceivedL,17381);
 assert.equal(r.transportDifferenceL,0);
 assert.equal(r.salesDuringReceptionL,null);
});

test('Solo las ventas DURANTE la descarga se suman al volumen recibido físico',()=>{
 const r=calculateReception({startVolumeL:17119,endVolumeL:34000,documentLiters:17000,otherIncomeLiters:0,
  meterMode:'meters',meterRows:[{hoseId:'H1',hoseName:'H1',productCode:'GE',primary:'digital',
   readings:{digital:{initial:10,final:129}}}],meterCoverageComplete:true});
 assert.equal(r.salesDuringReceptionL,119);
 assert.equal(r.physicalReceivedL,17000);
 assert.equal(r.transportDifferenceL,0);
});

test('La interfaz muestra el físico previo y no exige un cálculo histórico contable por producto',()=>{
 const code=read();
 assert.match(code,/Saldo físico del tanque ANTES de descargar/);
 assert.match(code,/format\(before\)/);
 assert.doesNotMatch(code,/accountingBeforeReception/);
 assert.match(code,/oldProductAccountingL:null/);
 assert.match(code,/Observación o autorización \(opcional\)/);
});

test('El valor físico predescarga ya se guarda de forma independiente en startVolumeL',()=>{
 const data=readFileSync(new URL('../src/receptionData.js',import.meta.url),'utf8');
 assert.match(data,/startVolumeL=volumeForHeight\(calibration.points,form.startHeightMm\)/);
 assert.match(data,/startVolumeL,endVolumeL,/);
});
