'use strict';
// v0.11.9b: sólo corrige el permiso para que owner o admin de estación
// creen invitaciones de operador. No altera reglas ni datos de otros módulos.
const fs = require('node:fs');
const path = require('node:path');
const rulesFile = path.join(process.cwd(), 'firestore.rules');
const backupFile = path.join(process.cwd(), 'firestore.rules.backup-before-invitations-v0119b');
const oldRule = "          (isAdmin(request.resource.data.stationId) && request.resource.data.role == 'operator')";
const newRule = "          (isManager(request.resource.data.stationId) && request.resource.data.role == 'operator')";
const count = (s, needle) => s.split(needle).length - 1;
function fail(msg) { console.error('CORRECCION CANCELADA: ' + msg); process.exit(1); }
if (!fs.existsSync(rulesFile)) fail('No existe firestore.rules en esta carpeta.');
const before = fs.readFileSync(rulesFile, 'utf8');
if (count(before, newRule) === 1 && count(before, oldRule) === 0) {
  console.log('INVITACIONES V0.11.9b: la corrección ya está aplicada; no se cambiaron archivos.');
  process.exit(0);
}
if (count(before, 'match /invitations/{emailId}') !== 1 ||
    count(before, 'match /operatorPilotShifts/{shiftId}') !== 1 ||
    count(before, 'match /products/{productId}') !== 1) {
  fail('Las reglas no parecen ser la versión reparada 0.11.9a (bloques duplicados o faltantes). No se modifica nada.');
}
if (count(before, oldRule) !== 1 || count(before, newRule) !== 0) {
  fail('No coincide la regla original de invitaciones. No se modifica nada.');
}
if (fs.existsSync(backupFile)) fail('Ya existe el respaldo de esta corrección; no se sobrescribe.');
const after = before.replace(oldRule, () => newRule);
if (after.replace(newRule, () => oldRule) !== before) fail('El cambio excede la regla prevista.');
// Crear respaldo primero; escribir versión nueva sólo después de validar.
fs.copyFileSync(rulesFile, backupFile, fs.constants.COPYFILE_EXCL);
try {
  const tempFile = rulesFile + '.tmp-v0119b';
  if (fs.existsSync(tempFile)) fail('Existe un archivo temporal anterior. Revísalo antes de continuar.');
  fs.writeFileSync(tempFile, after, {encoding:'utf8', flag:'wx'});
  fs.renameSync(tempFile, rulesFile);
} catch (error) {
  console.error('No se pudo escribir firestore.rules. El respaldo está intacto en ' + path.basename(backupFile));
  throw error;
}
console.log('INVITACIONES V0.11.9b: CORRECCION CORRECTA');
console.log('Gerencia (owner) y Administración (admin de la estación) pueden invitar operadores.');
console.log('Cambio único: isAdmin -> isManager para invitaciones de operador.');
console.log('Respaldo: ' + path.basename(backupFile));
console.log('Revisa el diff y publica SOLO firestore:rules. No hace falta Hosting.');
