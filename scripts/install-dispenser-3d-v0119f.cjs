'use strict';
// v0.11.9f — incorpora GLB ya entregado por el usuario, sin alterar módulos contables.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.cwd(),src=path.join(base,'src');
const payload=path.join(__dirname,'..','payload');
const source=path.join(src,'OperatorPilot.jsx');
const modelDest=path.join(base,'public','models','Petro_Surtidores_PRM.glb');
const expectedSourceHash='027ac487d324dea7173e719d5fdc84cb8df6cd6ae6eb1665b856390633ad83e7';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>fs.readFileSync(p);
function assertGlb(p){
 const b=read(p);
 if(b.length<256||b.subarray(0,4).toString()!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)throw Error('El GLB está incompleto o no es glTF 2.0.');
 const n=b.readUInt32LE(12),tag=b.subarray(16,20).toString();
 if(tag!=='JSON'||n<2||20+n>b.length)throw Error('El GLB no contiene cabecera JSON válida.');
 const j=JSON.parse(b.subarray(20,20+n).toString('utf8'));
 const names=new Set((j.nodes||[]).map(o=>o.name));
 for(const required of ['Dispensador_Gasolina_Rojo','Dispensador_Diesel_Azul','Dispensador_GNV_Plomo','Manguera_Gasolina_Roja','Manguera_Diesel_Azul','Manguera_GNV_Naranja','PRM_Puente_Regulacion_Medicion_Amarillo'])if(!names.has(required))throw Error('El GLB no contiene '+required);
}
if(!fs.existsSync(source))throw Error('Primero abre la carpeta del proyecto Distrigas Líquidos en PowerShell.');
const old=read(source),oldText=old.toString('utf8');
if(oldText.includes("from './DispenserPilot3D.jsx'")){
 if(['DispenserPilot3D.jsx','dispenserPilotCatalog.js','dispenserPilot3D.css'].every(n=>fs.existsSync(path.join(src,n)))&&fs.existsSync(modelDest)){
  console.log('Vista 3D v0.11.9f ya instalada; no se modificó nada.');process.exit(0);
 }
 throw Error('Instalación 3D incompleta; no se sobrescribió ningún archivo.');
}
if(sha(old)!==expectedSourceHash)throw Error('src/OperatorPilot.jsx no coincide con v0.11.9e. No se sobrescribe. Primero instala v0.11.9e o revisa cambios locales.');
const files=[
 {from:path.join(payload,'DispenserPilot3D.jsx'),to:path.join(src,'DispenserPilot3D.jsx')},
 {from:path.join(payload,'dispenserPilotCatalog.js'),to:path.join(src,'dispenserPilotCatalog.js')},
 {from:path.join(payload,'dispenserPilot3D.css'),to:path.join(src,'dispenserPilot3D.css')},
 {from:path.join(payload,'Petro_Surtidores_PRM.glb'),to:modelDest},
];
assertGlb(files[3].from);
for(const f of files){if(!fs.existsSync(f.from))throw Error('Falta archivo del paquete: '+f.from);if(fs.existsSync(f.to))throw Error('Ya existe '+f.to+'. No se reemplaza.');}
const newSource=read(path.join(payload,'OperatorPilot.jsx'));
if(!newSource.toString('utf8').includes("from './DispenserPilot3D.jsx'"))throw Error('Paquete inválido: falta importación del visor 3D.');
const backup=source+'.before-v0119f';
if(fs.existsSync(backup))throw Error('El respaldo '+backup+' ya existe. No se sobrescribe.');
const touched=[];
try{
 fs.mkdirSync(path.dirname(modelDest),{recursive:true});
 fs.writeFileSync(backup,old,{flag:'wx'});touched.push(backup);
 fs.writeFileSync(source,newSource);touched.push(source);
 for(const f of files){fs.writeFileSync(f.to,read(f.from),{flag:'wx'});touched.push(f.to);}
 console.log('Vista 3D v0.11.9f integrada. Se conservan los mismos IDs de las mangueras, datos y reglas.');
 console.log('Respaldo: src/OperatorPilot.jsx.before-v0119f');
 console.log('Siguiente: npm.cmd install three ; node --test .\\tests\\dispenser-3d-v0119f.test.mjs ; npm.cmd run build');
}catch(err){
 for(const p of touched.reverse()){try{if(p===source)fs.writeFileSync(source,old);else fs.unlinkSync(p);}catch{}}
 throw err;
}
