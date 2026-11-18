// Incorpora solamente las dos colecciones nuevas; conserva las reglas existentes.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'firestore.rules');
const fragmentFile = path.join(root, 'rules', 'international-v0116.fragment.rules');
if (!fs.existsSync(dest)) throw Error('No se encontró firestore.rules en esta carpeta.');
const old = fs.readFileSync(dest, 'utf8');
if (old.includes('match /internationalPriceHistory/') || old.includes('match /internationalDeposits/')) {
  throw Error('Ya existe una colección internacional en firestore.rules. Revisa y combina manualmente para evitar reglas duplicadas.');
}
const needle = '      function tankDocPath(tankId) {';
if (!old.includes(needle)) throw Error('No se reconoce la posición de inserción de las reglas. Se dejó firestore.rules sin cambios.');
const eol = old.includes('\r\n') ? '\r\n' : '\n';
const fragment = fs.readFileSync(fragmentFile, 'utf8').replace(/\r?\n/g,eol);
const backup = dest + `.respaldo-v0115-${Date.now()}`;
fs.copyFileSync(dest, backup);
fs.writeFileSync(dest, old.replace(needle, () => fragment+needle), 'utf8');
console.log('Se añadieron SOLO internationalPriceHistory e internationalDeposits.');
console.log('Respaldo:', backup);
console.log('Revisa: git --no-pager diff -- firestore.rules');
