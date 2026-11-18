 'use strict';
// v0.11.9h: horario automatico solo para HOY. No reglas ni libros oficiales.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),src=path.join(root,'src'),payload=path.join(__dirname,'..','payload');
const hashes={
  "OperatorPilot.jsx": "626bcc5c9d5891f1d019b075817e6851c63749c820a2f9157ac5906c127ec581",
  "operatorPilotUX.js": "10f1322eb59baab60d36016ee10370e27a62561cefc48d0b7d3b193db5cd0020",
  "operatorPilotMath.js": "9b818d186a74f9add517e34f81d7250d4fdd9b309420d802e601c5d6a8bfffc3",
  "operatorPilotData.js": "ca571c3566a4175ed083557671f7232dd30ea69c97cec7cb129fe855a67da79b"
};
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
function fail(msg){throw Error(msg+' No se modifico ningun archivo.');}
if(!fs.existsSync(src))fail('Abre primero la carpeta del proyecto (falta src).');
const items=Object.entries(hashes).map(([name,oldHash])=>{
 const file=path.join(src,name),source=path.join(payload,name);
 if(!fs.existsSync(file)||!fs.existsSync(source))fail('Falta '+name+' en src o en el ZIP.');
 return {name,file,old:fs.readFileSync(file),next:fs.readFileSync(source),oldHash,backup:file+'.before-v0119h'};
});
if(items.every(x=>digest(x.old)===digest(x.next))){
 console.log('v0.11.9h ya instalada. Sin cambios.');process.exit(0);
}
for(const x of items){
 if(digest(x.old)!==x.oldHash)fail('src/'+x.name+' no coincide con v0.11.9g. No se sobrescribira: revisa que tengas las versiones anteriores.');
 if(fs.existsSync(x.backup))fail('Ya existe el respaldo '+x.backup);
}
const made=[];
try{
 for(const x of items){fs.writeFileSync(x.backup,x.old,{flag:'wx'});made.push({kind:'backup',x});}
 for(const x of items){fs.writeFileSync(x.file,x.next);made.push({kind:'updated',x});}
 console.log('v0.11.9h aplicada. Retroactivo: SOLO fecha; HOY: entrada y salida automaticas.');
 console.log('Lecturas historicas sincronizadas sin inventar horas; permite retomar meters dias posteriores.');
 console.log('Respaldos src/*.before-v0119h. No se modificaron reglas ni datos existentes.');
}catch(err){
 for(const {kind,x} of made.reverse()){
  try{if(kind==='updated')fs.writeFileSync(x.file,x.old);else fs.unlinkSync(x.backup)}
  catch(e){console.error('Restauracion manual necesaria: '+x.file+' '+e.message);}
 }throw err;
}
