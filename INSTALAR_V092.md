# Distrigas Líquidos · Corrección v0.9.2 – continuidad de meters y auditoría

**Aplicar sobre v0.9.1.** No modifica reglas Firestore, colecciones, lecturas guardadas, datos iniciales ni `.env`.

## Cambios

1. Los datos iniciales se presentan como **base de cierre del día anterior** al arranque. Si la fecha inicial es 01/11/2026, aparecen como referencia en 31/10/2026. No se crea un despacho ni un cierre ficticio en Firebase.
2. Con arqueos guardados, el libro muestra el primer inicial, el último final y la suma de litros o m³, por manguera. En fechas sin arqueo, muestra el último final conocido como lectura de apertura y señala **Final pendiente**.
3. Meters y Movimientos usan los mismos arqueos de Firestore. Los que no pueden vincularse a las mangueras actuales se muestran como **Sin vincular**, con el detalle de las fechas, productos e IDs; **no** se vuelven a insertar ni se adjudican automáticamente a otra manguera.
4. Si un arqueo antiguo tiene exactamente el mismo nombre de manguera pero un ID distinto, se advierte para evitar repetirlo.
5. Lecturas previas a la fecha inicial no sustituyen los valores de Datos iniciales.
6. La misma continuidad se muestra para las mangueras GNV, y se señala el cierre de referencia de los tres controles del puente GNV.

## Instalación desde PowerShell

Descargar `distrigasliquidos-continuidad-meters-v0.9.2.zip` a Descargas.

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v091"
cd $proyecto
New-Item -ItemType Directory -Path "$respaldo\src" -Force | Out-Null
Copy-Item "src\MeterBook.jsx", "src\meterSummary.js", "src\meterMath.js", "src\meter.css" -Destination "$respaldo\src" -Force
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-continuidad-meters-v0.9.2.zip" -DestinationPath $proyecto -Force
node --test tests/meter-continuity.test.js
npm.cmd run test:meter
npm.cmd run test:movement
npm.cmd run build
```

Publicar **solo si compiló**:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Guardar en GitHub una vez comprobado:

```powershell
git add src/MeterBook.jsx src/meterSummary.js src/meterMath.js src/meter.css tests/meter-continuity.test.js
git commit -m "Corrige continuidad y conciliacion de meters v0.9.2"
git push
```

## Validación

1. Seleccionar fecha 01/11/2026 en Meters. Confirmar que **31/10** muestra las lecturas base, sin litros facturados.
2. Comprobar que las mangueras de gasolina muestran el resumen del **01/11** cuando sus arqueos están asociados a las mangueras configuradas.
3. Si Movimientos registra litros y el resumen de las mangueras no, aparecerá una columna **Sin vincular** y la alerta con los IDs. **No reingresar** esos registros; revisar si son mangueras históricas o registros creados con otro ID.
4. Confirmar que GNV usa su dato inicial como referencia del cierre del día anterior y su siguiente valor solo se obtiene cuando haya final real.

### Advertencia

Este parche no cambia datos existentes en Firestore y tampoco corrige por sí solo una asociación histórica que sea realmente incorrecta. Si aparece **Sin vincular**, envía una captura del detalle (ocultando información sensible), para preparar la migración validada sin duplicar despachos.
