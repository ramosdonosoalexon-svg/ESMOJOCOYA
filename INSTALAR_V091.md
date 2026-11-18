# Distrigas Líquidos — Corrección Meters v0.9.1

Esta actualización está diseñada para instalarse **sobre la versión v0.9**.

## Qué corrige

1. La tabla superior de Meters muestra por manguera el primer valor inicial y el último valor final de los arqueos guardados del día, en mecánico y digital cuando ambos existen, así como volumen total y número de intervalos.
2. Meters reconoce registros antiguos de `meterShifts` sin el campo `status`, al igual que Movimiento de productos. Los registros anulados continúan excluidos.
3. Conserva la tabla de cuatro fechas y los turnos intermedios, sin duplicar el volumen al mostrar los dos contadores.
4. No escribe ni modifica datos en Firebase. No cambia `firestore.rules` ni `.env`.

**ATENCIÓN:** La captura compartida de Meters muestra gasolina (GE 3A, GE 3B, GE 4A, GE 4B), mientras que la captura de Movimientos muestra DIÉSEL OIL. Los 2.533,98 litros mostrados en Diésel Oil no deben aparecer en Gasolinas; hay que verificar la sección Diésel Oil dentro de Meters.

## Instalar en PowerShell

Descargar `distrigasliquidos-meters-resumen-v0.9.1.zip` a la carpeta Descargas.

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
cd $proyecto

# Respaldo local (el .env y Firestore quedan intactos)
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v09-antes-v091"
New-Item -ItemType Directory -Force -Path "$respaldo\src" | Out-Null
Copy-Item "src\MeterBook.jsx","src\meterMath.js","src\meter.css" -Destination "$respaldo\src" -Force

# Copiar actualización
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-meters-resumen-v0.9.1.zip" -DestinationPath $proyecto -Force

# Comprobar
node --test tests/meter-summary.test.js
npm.cmd run test:meter
npm.cmd run test:movement
npm.cmd run build
```

Publicar **solo si todas las pruebas y el build finalizan sin errores**:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Actualizar GitHub, después de probar la web:

```powershell
git add src/MeterBook.jsx src/meterMath.js src/meterSummary.js src/meter.css tests/meter-summary.test.js
git commit -m "Meters v0.9.1 - sincronizar resumen de lecturas con movimientos"
git push
```

## Verificación funcional

1. Seleccionar fecha `2026-11-01` en **Meters y arqueos**.
2. Desplazarse a la sección **Diéseles** (no Gasolinas).
3. En la fila `01/11`, comprobar en cada manguera la lectura inicial, lectura final y volumen.
4. Sumar el volumen de todas las mangueras de Diésel Oil y compararlo con **Movimientos → Diésel Oil → Meters**, para la misma fecha.
5. Verificar que la tabla de Gasolina no se complete con volúmenes de Diésel.
6. Si aún hay diferencia, comparar el listado inferior de registros guardados y verificar que los arqueos estén asociados a la manguera y producto correctos; no volver a ingresarlos ni duplicarlos.

La prueba real de compilación Vite y de sincronización con Firebase deben completarse en la computadora del proyecto.
