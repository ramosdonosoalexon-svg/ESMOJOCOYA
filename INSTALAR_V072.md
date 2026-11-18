# Distrigas Líquidos v0.7.2 — Corregir mangueras antiguas en Meters

## Causa
Las mangueras creadas en v0.1–v0.3 guardan `feedTankIds` pero no `productCode`. Configuración muestra el combustible deducido del tanque; Meters no realizaba esa misma deducción y por ello mostraba «0 mangueras activas» aun con datos iniciales guardados.

## Alcance
Solo modifica `src/App.jsx`, `src/MeterBook.jsx`, agrega `src/hoseCompat.js` y prueba de compatibilidad. No cambia reglas, colecciones, documentos, precios, `.env`, ni mangueras existentes. El código calcula temporalmente el producto de cada manguera antigua a partir de sus tanques de alimentación.

## Instalación en PowerShell (desde Descargas)
```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v071-meters"
New-Item -ItemType Directory -Path "$respaldo\src" -Force | Out-Null
Copy-Item "$proyecto\src\App.jsx", "$proyecto\src\MeterBook.jsx" -Destination "$respaldo\src" -Force
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-meters-fix-v0.7.2.zip" -DestinationPath $proyecto -Force
cd $proyecto
node --test tests/hose-compat.test.js
npm.cmd run test:meter
npm.cmd run build
```

Solo después de compilar sin errores:
```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

En la web: Configuración muestra G-1, G-2 conectadas a TK2, y Meters debe reconocer ambas en Gasolina Especial, mostrando los iniciales mecánico y digital. Si también está habilitada GE+, se habilita el selector de cambio de gasolina de cada manguera. No se duplican.

Actualizar GitHub después de probar:
```powershell
git add src/App.jsx src/MeterBook.jsx src/hoseCompat.js tests/hose-compat.test.js
git commit -m "Corregir mangueras antiguas en meters v0.7.2"
git push
```

**Nota:** si el aviso indica que una manguera no tiene producto deducible, revisar en Configuración su tanque vinculado; no borrarla ni reiniciar sus meters. 
