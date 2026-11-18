// Reparación v0.11.9a. Recupera las reglas previas y añade exactamente UN bloque de pruebas.
// No altera datos de Firebase ni reemplaza reglas de otros módulos.
const fs=require('node:fs');
const path=require('node:path');
const cwd=process.cwd();
const rules=path.join(cwd,'firestore.rules');
const before=path.join(cwd,'firestore.rules.backup-before-operator-pilot-v0119');
const installer=path.join(cwd,'scripts','install-operator-pilot-rules-v0119.cjs');
const anchor='      match /products/{productId} {';
const marker='match /operatorPilotShifts/{shiftId}';
function stop(message){console.error('REPARACION CANCELADA: '+message);process.exit(1);}
if(!fs.existsSync(rules))stop('No existe firestore.rules. Abre la carpeta distrigasliquidos.');
if(!fs.existsSync(before))stop('No está firestore.rules.backup-before-operator-pilot-v0119. No sobrescribiremos reglas; comunica este resultado.');
if(!fs.existsSync(installer))stop('No existe el instalador corregido. Extrae el ZIP de reparación en la carpeta del proyecto.');
const base=fs.readFileSync(before,'utf8');
const current=fs.readFileSync(rules,'utf8');
const src=fs.readFileSync(installer,'utf8');
if(base.includes(marker))stop('El respaldo ya contiene reglas del piloto; necesitamos verificar otro respaldo.');
if(base.split(anchor).length!==2)stop('El respaldo no tiene exactamente una sección products. No se modifica nada.');
if(!base.trimEnd().endsWith('}'))stop('El respaldo está incompleto. No se modifica nada.');
if(!src.includes('body=body.replace(anchor,()=>block+anchor);'))stop('El instalador todavía usa la sustitución incorrecta. No se modifica nada.');
const match=/const block=`([\s\S]*?)`;\s*body=body\.replace\(anchor,\(\)=>block\+anchor\);/.exec(src);
if(!match)stop('No se pudo extraer el bloque corregido del instalador.');
const block=match[1];
if(!block.includes(marker) || !block.includes('match /operatorPilotReadings/{readingId}'))stop('Bloque del piloto incompleto.');
// Callback de replace: evita interpretar $' en expresiones regulares como una copia del resto del archivo.
const repaired=base.replace(anchor,()=>block+anchor);
if(repaired.replace(block,'')!==base)stop('La reparación modificó contenido ajeno al módulo.');
if(repaired.split(marker).length!==2 || repaired.split(anchor).length!==2)stop('Quedaron bloques duplicados.');
if(repaired.length>base.length+block.length+10)stop('El archivo resultante creció inesperadamente.');
if(current===repaired){console.log('Las reglas ya están reparadas. No se hicieron cambios.');process.exit(0);}
const safety=path.join(cwd,'firestore.rules.corrupto-respaldo-v0119a');
if(fs.existsSync(safety))stop('Ya existe '+path.basename(safety)+'. No se sobrescribe; revisa qué cambió desde la primera reparación.');
fs.copyFileSync(rules,safety);
fs.writeFileSync(rules,repaired,'utf8');
console.log('REPARACION CORRECTA');
console.log('Respaldo usado: '+path.basename(before));
console.log('Reglas averiadas conservadas en: '+path.basename(safety));
console.log('Líneas previas: '+base.split('\n').length+'; reparadas: '+repaired.split('\n').length);
console.log('Bloque de operador agregado UNA vez. Ahora ejecuta pruebas y comprueba el diff antes del deploy.');
