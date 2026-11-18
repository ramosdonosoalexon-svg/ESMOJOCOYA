# Distrigas Líquidos – Actualización v0.8.1

## Qué se cambia

- Barra lateral: Reportes ANH, Reportes Sustancias Controladas y Reportes Impuestos Nacionales. Son secciones navegables de preparación; todavía no generan reportes oficiales.
- Domingos resaltados como referencia visual (no se bloquean las ventas, los inventarios ni los arqueos) en Movimientos, Inventarios, Recepciones y Meters.
- No se cambian esquemas de Firestore, reglas, cálculos, inventarios ni recepciones.
- Incluye nota de diseño del kardex postpago, no implementación de cobros todavía.

## Instalación en Windows con PowerShell

1. Descarga el ZIP `distrigasliquidos-reportes-domingos-v0.8.1.zip` a Descargas.
2. Ejecuta:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-reportes-domingos-v0.8.1.zip"

cd $proyecto

# Validar antes de modificar archivos
if (!(Test-Path $zip)) { throw "No existe el ZIP: $zip" }
if (!(Test-Path "$proyecto\src\App.jsx")) { throw "No se encontró el proyecto original" }

# Respaldo de archivos actuales. No incluye .env ni toca Firestore.
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v08-$(Get-Date -Format 'yyyyMMdd-HHmm')"
New-Item -ItemType Directory -Path "$respaldo\src" -Force | Out-Null
@('App.jsx','Operations.jsx','ReceptionBook.jsx','MeterBook.jsx','MovementBook.jsx','styles.css','inventoryVisual.css','reception.css','meter.css','movement.css') | ForEach-Object {
  Copy-Item "$proyecto\src\$_" "$respaldo\src\$_" -Force
}

# Instalar el parche (solo archivos de pantalla y calendario)
Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force

# Probar cálculos y compilar
node --test tests/report-calendar.test.js
npm.cmd run test:movement
npm.cmd run build
```

3. Solo cuando `npm.cmd run build` finalice correctamente, publicar:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

4. Comprueba https://distrigasliquidos.web.app (Ctrl+F5 si hay caché):
   - Menú lateral: 3 apartados nuevos de reportes, con regreso al panel.
   - Movimiento de productos: domingos en rojo tenue y marca DOM.
   - Inventarios, Recepciones y Meters: domingos marcados, con captura y ventas permitidas.

5. Cuando compruebes que funciona, subir a GitHub:

```powershell
git add src/App.jsx src/MovementBook.jsx src/Operations.jsx src/ReceptionBook.jsx src/MeterBook.jsx src/reportCalendar.js src/styles.css src/movement.css src/inventoryVisual.css src/reception.css src/meter.css tests/report-calendar.test.js

git commit -m "Distrigas Liquidos v0.8.1 - Reportes y domingos"
git push
```

**No necesitas desplegar Firestore Rules para este parche.** La base de datos y los documentos permanecen intactos.
