# Distrigas Líquidos v0.9.7 · PRM y detección de arqueos desactualizados

**Parche incremental sobre la versión v0.9.6.** No altera las reglas, no borra documentos y **no recalcula directamente los registros históricos de Firebase**.

## Qué cambia

1. **Libro del PRM de GNV**, con las tres lecturas independientes: manual/analógico, volumen corregido y no corregido. Vista del cierre base del 31/10, día operativo y siguiente; permite consultar todo el mes.
2. El inicial del 31/10 se muestra como **base, no como ventas**; el final de un día pasa al siguiente. Se exige guardar el día anterior antes de cerrar un día posterior.
3. Entrada segura del final: **sin separadores de miles**. Por ejemplo, si el contador es 83.837.991, escribir `83837991`; si es 838.379, escribir `838379`. Utilizar punto únicamente si existen fracciones decimales. NO adivinar decimales ni escalas.
4. Meters y Movimientos alertan si `readings.<principal>.final - initial` difiere de `grossVolume` y `meterTotals` guardados. Los datos anteriores permanecen sin modificar hasta rectificación autorizada.
5. No se mezclan los registros PRM (colección `gnvBridge`) con los de los dispensers (colección `meterShifts`).

## Instalación Windows PowerShell

Descargar `distrigasliquidos-prm-control-v0.9.7.zip` a Descargas:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$archivo = "$env:USERPROFILE\Downloads\distrigasliquidos-prm-control-v0.9.7.zip"
if (!(Test-Path $archivo)) { throw "No se encontró el ZIP en Descargas." }
cd $proyecto

$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v096\src"
New-Item -ItemType Directory -Path $respaldo -Force | Out-Null
foreach ($f in @('MeterBook.jsx','MovementBook.jsx','meter.css','movement.css')) {
  if (Test-Path "src\$f") { Copy-Item "src\$f" "$respaldo\$f" -Force }
}
Expand-Archive -LiteralPath $archivo -DestinationPath $proyecto -Force
node --test .\tests\gnv-reconciliation-v097.test.mjs
npm.cmd run build
```

**Publicar SOLO cuando las pruebas y la compilación terminen correctamente:**

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

No es necesario desplegar `firestore.rules` para esta versión. Recargar con `Ctrl+Shift+R`.

## Qué ocurre con la corrección manual que ya se hizo en Firebase

Un `meterShift` guarda varios campos relacionados: `readings`, `meterTotals`, `grossVolume`, `movementLines`, `netTankOutVolume`, `amountBs`. Si solo cambias `readings.digital.final`, los otros campos NO se actualizan automáticamente. Es importante no cambiarlos a mano de forma aislada.

Ejemplo GNV 2A, 01/11/2026:

- Digital inicial: 341558.01
- Digital final: 343047.71
- Diferencia correcta: **1489.70 m³**
- Volumen histórico que aún muestra el sistema: **1.49 m³**
- Diferencia no conciliada: **1488.21 m³**
- Total de los cuatro dispensers según lecturas de la captura: **5646.41 m³** (si los cuatro cierres son correctos). Total guardado actual: **4158.20 m³**.

La v0.9.7 advierte de la diferencia. **No cambia automáticamente `grossVolume` ni revaloriza facturación/cuentas**: se necesita rectificación con trazabilidad.

### Procedimiento de rectificación en la estación de PRUEBAS

1. Copiar o tomar captura de los datos del arqueo original de **GNV 2A**: fecha, hora, iniciales, finales, conceptos, volumen, precio y referencias. No borrar el documento.
2. **Antes de anular** verificar si hay arqueos de GNV 2A el 02/11 y posteriores. Su lectura inicial debe coincidir con el último final correcto anterior; si NO coincide, no continuar y revisar la cadena completa.
3. Con cuenta propietaria, en **Meters → 01/11/2026 → GNV 2A**, usar **Anular** en el registro incorrecto, escribiendo motivo descriptivo de 8 caracteres o más. El historial se conserva como anulado.
4. En el mismo día/manguera usar **Otro turno**. La lectura inicial se hereda automáticamente (verificar que sea 341558.01), escribir **343047.71** de final (mecánico y digital solo si ambos coinciden realmente), revisar que el despacho muestre **1489.70 m³**. Reponer exactamente la información de vales o conceptos del registro original y guardar.
5. Revisar que el total GNV del 01/11 pase a **5646.41 m³** y que Movimientos se recalcule. El registro anulado debe seguir visible en Firestore, sin aportar volumen.

**No ejecutar este procedimiento en producción** sin autorización para rectificar y sin confirmar los movimientos posteriores y la conciliación de cobros, vales y facturación. Si la cuenta/manguera ya tienen registros posteriores inconsistentes, es necesario un procedimiento de corrección más amplio.

## Puente PRM

El PRM se guarda en `stations/{stationId}/gnvBridge/{YYYY-MM-DD}`. El PRM NO es un dispenser ni se alimenta automáticamente de sus `meterShifts`.

Para el 01/11, los tres datos iniciales vienen del 31/10 en `initialGNVBridge/start`. Las lecturas finales se registran en la tabla del puente y se guardan con **Guardar puente del día**. Si solo las escribes sin guardar, no aparecerán como cierre confirmado. Los valores que se muestran en la captura (`83,837991` para el manual, y `838.379` para el no corregido) deben ingresarse sin separadores de miles y verificarse contra los contadores físicos.

La equivalencia `K = J × 28,31701636` se mantiene tal como estaba definida para la matriz. **Verificar la unidad técnica del contador** antes de usar el valor en un cierre oficial.

## Validación técnica del parche

- 7 pruebas unitarias de lógica pasaron en el entorno de desarrollo.
- `MeterBook.jsx` y `MovementBook.jsx` pasaron revisión de sintaxis JSX con TypeScript.
- La compilación con Vite y la validación contra los registros reales deben completarse en Windows antes de publicar.
