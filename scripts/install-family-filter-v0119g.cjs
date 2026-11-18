'use strict';
// Distrigas Liquidos v0.11.9g — correccion de filtro GNV/gasolinas/diesel.
// Instalador seguro: NO altera datos, reglas Firestore, despliegues ni GLB.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = process.cwd();
const src = path.join(base,'src');
const payload = path.join(__dirname,'..','payload');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const changes = [
  ['OperatorPilot.jsx','cb3a0e76d6377756c2d5c68b1b7a467553844862301abeb9adc5313479e4fb2a'],
  ['DispenserPilot3D.jsx','1423fb1a31fc29911dba38bb032ea310d3ce397c28bb7697ee87085bfa8701c0'],
  ['dispenserPilotCatalog.js','12da074d1fe21f30288d0493a69f71ee3adea4f7f2de04a4d3f8b8a88481086c'],
];
const extra='operatorFamilyFilter-v0119g.css';
function fail(message){throw Error(message+' No se modifico ningun archivo.');}
if(!fs.existsSync(src))fail('No estas en la carpeta del proyecto (falta src).');
const inputs=changes.map(([name,oldHash])=>{
 const dest=path.join(src,name),source=path.join(payload,name);
 if(!fs.existsSync(dest)||!fs.existsSync(source))fail('Falta '+name+' en src o en el paquete.');
 return {name,dest,source,oldHash,old:fs.readFileSync(dest),next:fs.readFileSync(source),backup:dest+'.before-v0119g'};
});
const newCSS=path.join(src,extra),cssSource=path.join(payload,extra);
if(!fs.existsSync(cssSource))fail('Falta el CSS de filtrado.');
if(inputs.every(x=>sha(x.old)===sha(x.next)) && fs.existsSync(newCSS) && sha(fs.readFileSync(newCSS))===sha(fs.readFileSync(cssSource))){
 console.log('v0.11.9g ya instalada. No hay cambios.');process.exit(0);
}
for(const x of inputs){
 if(sha(x.old)!==x.oldHash)fail(x.name+' tiene cambios distintos a v0.11.9f; no se sobrescriben. Revisa tu version local.');
 if(fs.existsSync(x.backup))fail('El respaldo '+x.name+'.before-v0119g ya existe.');
}
if(fs.existsSync(newCSS))fail('Ya existe src/'+extra+'; no se sobreescribe.');
const made=[];
try{
 for(const x of inputs){fs.writeFileSync(x.backup,x.old,{flag:'wx'});made.push({kind:'backup',path:x.backup});}
 for(const x of inputs){fs.writeFileSync(x.dest,x.next);made.push({kind:'change',path:x.dest,original:x.old});}
 fs.writeFileSync(newCSS,fs.readFileSync(cssSource),{flag:'wx'});made.push({kind:'new',path:newCSS});
 console.log('Correcto: GNV solo muestra GNV; Gasolina solo GE y GE+; Diesel solo DO y D_ULS.');
 console.log('No se borraron lecturas del turno ni se alteraron los meters oficiales.');
 console.log('Respaldos: src/*.before-v0119g');
 console.log('Ahora ejecuta: node --test .\\tests\\operator-family-v0119g.test.mjs && npm.cmd run build');
}catch(err){
 for(const p of made.reverse()){
  try{if(p.kind==='change')fs.writeFileSync(p.path,p.original);else fs.unlinkSync(p.path);}catch(e){console.error('Debes revisar la restauracion de '+p.path+': '+e.message);}
 }
 throw err;
}
