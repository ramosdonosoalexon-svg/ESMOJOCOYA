'use strict';
// v0.11.9e: cambio exclusivo de la interfaz del piloto de operadores.
// No reemplaza App.jsx, no toca Firestore ni los reportes oficiales.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd();
const src=path.join(root,'src'),source=path.join(src,'OperatorPilot.jsx'),cssFile=path.join(src,'operatorPilot.css');
const scriptDir=path.dirname(__filename);const payload=path.join(scriptDir,'..','payload');
const baseHash='5172d028305ee007dec9aed83b2ffaf456bda9ae5f01ccc63be3b34761f7820c';
const marker='/* v0.11.9e: interfaz táctil reducida.';
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function get(p){if(!fs.existsSync(p))throw Error('Falta archivo: '+p);return fs.readFileSync(p,'utf8');}
if(!fs.existsSync(src))throw Error('Abre la carpeta del proyecto Distrigas Líquidos antes de ejecutar el instalador.');
const oldSource=get(source),oldCss=get(cssFile);
if(oldSource.includes("from './operatorPilotUX'")){
 if(oldCss.includes(marker)&&fs.existsSync(path.join(src,'operatorPilotUX.js'))&&fs.existsSync(path.join(src,'OperatorQRScanner.jsx'))){console.log('v0.11.9e ya instalada. No se modificó nada.');process.exit(0);}
 throw Error('v0.11.9e está incompleta o alterada. No se modificó nada.');
}
if(digest(oldSource)!==baseHash)throw Error('OperatorPilot.jsx no coincide con el piloto v0.11.9. Se cancela para conservar tus cambios. Envíame la diferencia de ese archivo antes de instalar.');
if(oldCss.includes(marker))throw Error('El CSS ya contiene v0.11.9e, pero JSX no. No se modificó nada.');
const modifiedSource=get(path.join(payload,'OperatorPilot.jsx'));
const modifiedCss=oldCss+'\n'+get(path.join(payload,'operatorPilot-e.css'));
const aux=[['operatorPilotUX.js','operatorPilotUX.js'],['OperatorQRScanner.jsx','OperatorQRScanner.jsx']];
for(const [name] of aux)if(fs.existsSync(path.join(src,name)))throw Error('Existe src/'+name+'. No se sobrescribe.');
const backupSource=source+'.before-v0119e',backupCss=cssFile+'.before-v0119e';
if(fs.existsSync(backupSource)||fs.existsSync(backupCss))throw Error('El respaldo v0119e ya existe. No se sobrescribe.');
if(!modifiedSource.includes("from './operatorPilotUX'"))throw Error('Paquete incompleto: falta la mejora de mangueras.');
if(!modifiedSource.includes('OperatorQRScanner'))throw Error('Paquete incompleto: falta escáner.');
const extra=aux.map(([dest,name])=>({dest:path.join(src,dest),body:get(path.join(payload,name))}));
const changed=[];
try{
 fs.writeFileSync(backupSource,oldSource);fs.writeFileSync(backupCss,oldCss);
 fs.writeFileSync(source,modifiedSource);changed.push(source);
 fs.writeFileSync(cssFile,modifiedCss);changed.push(cssFile);
 for(const x of extra){fs.writeFileSync(x.dest,x.body,{flag:'wx'});changed.push(x.dest);}
 console.log('v0.11.9e aplicada: panel táctil, lectura sugerida, fechas y QR.');
 console.log('Respaldos: src/OperatorPilot.jsx.before-v0119e, src/operatorPilot.css.before-v0119e.');
 console.log('Siguiente paso: npm.cmd install @zxing/browser; pruebas; npm.cmd run build.');
}catch(e){
 for(const p of changed.reverse()){if(p===source)fs.writeFileSync(source,oldSource);else if(p===cssFile)fs.writeFileSync(cssFile,oldCss);else try{fs.unlinkSync(p)}catch{}}
 try{fs.unlinkSync(backupSource)}catch{}try{fs.unlinkSync(backupCss)}catch{}
 throw e;
}
