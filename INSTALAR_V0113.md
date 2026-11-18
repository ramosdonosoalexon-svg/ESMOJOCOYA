# Distrigas Líquidos v0.11.3 — Matriz GNV y control mensual

Actualización incremental sobre la versión 0.11.2. No elimina ni modifica documentos existentes de Firebase, no cambia reglas de Firestore ni interviene en dispensers/PRM reales. Solo cambia la visualización de Movimientos y los cálculos derivados de registros ya existentes.

## Cambios

1. La tabla GNV se presenta como la matriz de operaciones: **Medida PRM** (manual y corregido); **Salidas por meters** (venta contado, consumo propio, calibración, prepago, postpago, otros, sin clasificar y total dispensers); **Control diario** (dispensers menos corregido); observaciones; y columna de **%** a la derecha, separada con línea punteada.
2. **Diferencia diaria = dispensers - PRM corregido**. Negativa en rojo (merma técnica estimada), positiva en verde (demasía técnica estimada). El contador PRM no corregido, importe y detalles se consultan con el botón del ojo.
3. **Porcentaje diario = diferencia diaria / PRM corregido × 100**; vacío si faltan datos. No inventa despachos cero.
4. Los metros del dispenser se suman **una sola vez**; sus conceptos son solo una clasificación interna. Los arqueos históricos inconsistentes se identifican como «sin clasificar» y se avisan en el detalle.
5. **Referencia para el mes siguiente**: promedio ponderado de merma y demasía del mes anterior completo, calculado desde los documentos PRM y meter guardados en cada fecha. Promedio merma = suma de diferencias negativas en magnitud / suma de PRM corregido. Demasías se muestran por separado.
6. Si el promedio de merma del mes actual supera el del mes anterior completo, se avisa. Si lo supera en **más del 10 % relativo**, se muestra una alerta crítica. Ejemplo: referencia 3,00 % → umbral 3,30 %, no 13 %. Si falta un mes completo, se muestra «sin referencia».
7. La alerta es un **indicio que requiere verificación técnica**, nunca una certificación automática de fuga. Los distintos cortes de lectura, condiciones de presión/temperatura, calibración o contadores pueden producir discrepancias.

## Instalación en Windows / PowerShell

```powershell
$ErrorActionPreference = 'Stop'
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-gnv-matriz-v0.11.3.zip"
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v0112\src"

if (!(Test-Path $zip)) { throw 'No aparece el ZIP en Descargas. Comprueba el nombre del archivo.' }
Set-Location $proyecto
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($file in @('MovementBook.jsx','movementMath.js','movement.css')) {
  Copy-Item "src\$file" "$backup\$file" -Force
}
Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force
node --test .\tests\gnv-matrix-v0113.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas GNV; NO publicar.' }
npm.cmd run test:movement
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas de movimientos; NO publicar.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación; NO publicar.' }
```

## Publicar (después de compilar)

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

No es necesario ejecutar `deploy --only firestore:rules`.

## Verificación

- En Movimientos → GNV → noviembre 2026, revisar PRM 01/11 = 5.815 m³, dispenser = 5.646,41 m³, diferencia **−168,59 m³ (−2,90 %)**.
- 02/11 = **−140,21 m³ (−2,37 %)**; 03/11 = **−123,60 m³ (−2,15 %)** si los registros actuales conservan esos volúmenes.
- Revisar el total y las categorías de salidas, así como el tercer contador PRM en el botón del ojo.
- No esperar alerta de comparación con octubre si no existe un registro PRM y de dispensers para **todos los días** de ese mes.
- Si aparecen advertencias de volúmenes GNV históricos no conciliados en la parte superior, se deben rectificar de forma trazable; no se corrigen datos directamente con esta versión.

## Guardar en GitHub (opcional, después de validar)

```powershell
git add src/MovementBook.jsx src/movementMath.js src/gnvRiskMath.js src/movement.css tests/gnv-matrix-v0113.test.mjs
git commit -m "GNV v0.11.3: matriz y alertas mensuales"
git push
```
