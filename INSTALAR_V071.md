# Distrigas Líquidos – Actualización v0.7.1

Actualización incremental sobre la versión v0.7 de Meters y Arqueos. No incluye `.env`, no borra Firestore y no ejecuta migraciones de datos.

## Cambios

1. **Datos iniciales → GNV:** tres lecturas independientes de puente: meter manual (analógico), volumen corregido y volumen no corregido. Se guardan en `stations/{stationId}/initialGNVBridge/start`.
2. **Meters líquidos:** al abrir el primer turno de una manguera usa las lecturas mecánica/digital ya guardadas en `initialMeters`; no exige que el registro ocurra el mismo día de arranque. Al existir arqueos anteriores, el siguiente inicial es la última lectura final válida de esa manguera.
3. **Gasolinas:** si GE y GE+ están habilitadas, la manguera de gasolina muestra «Cambio de gasolina». Seleccionar el producto mueve el registro al apartado de la gasolina seleccionada. El cambio queda documentado en el siguiente arqueo, conservando el contador y el historial; no crea un segundo tanque físico.
4. **Meters GNV:** primero aparece el puente de regulación con tres controles (inicial, final, diferencia); después aparecen las mangueras de los dispensers, con sus iniciales tomados de Datos iniciales.
5. **Matriz GNV:** diferencia = final - inicial para cada contador. El control no corregido muestra además la equivalencia de la matriz `K = J × 28,31701636`, conservando ambos valores. Confirmar unidades/factor del medidor de la instalación antes del cierre oficial.
6. La hora de arqueo ya tiene campo y valor inicial, evitando el error de variable sin inicializar.

## Instalación (PowerShell)

Descargar `distrigasliquidos-meters-gnv-v0.7.1.zip` en Descargas:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
cd $proyecto
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v070"
New-Item -ItemType Directory -Path "$respaldo\src" -Force | Out-Null
Copy-Item .\src\MeterBook.jsx,.\src\Operations.jsx,.\src\operationsData.js,.\src\meterData.js,.\src\meterMath.js,.\src\meter.css -Destination "$respaldo\src" -Force
Copy-Item .\firestore.rules,.\package.json -Destination $respaldo -Force
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-meters-gnv-v0.7.1.zip" -DestinationPath $proyecto -Force
npm.cmd run test:gnv
npm.cmd run test:meter
npm.cmd run build
```

**Publicar solo si `npm.cmd run build` termina sin errores.** Esta versión cambia reglas de Firestore:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Subir código a GitHub tras validar:

```powershell
git add src/Operations.jsx src/operationsData.js src/MeterBook.jsx src/meterData.js src/meterMath.js src/gnvBridgeMath.js src/meter.css firestore.rules package.json tests/gnv-bridge.test.js INSTALAR_V071.md
git commit -m "Meters v0.7.1 - iniciales, cambio GE GE+ y puente GNV"
git push
```

## Pruebas guiadas

1. Datos iniciales: comprobar iniciales ya guardados de mangueras de gasolina y diésel; registrar tres iniciales del puente GNV.
2. Meters: una manguera sin arqueos previos debe mostrar automáticamente sus iniciales mecánico y/o digital. No se suman ambos medidores.
3. Habilitar GE y GE+ y usar «Cambio de gasolina» en una manguera: siguiente arqueo aparece bajo el nuevo producto y toma como inicial la lectura final anterior.
4. En GNV: puente primero, los tres componentes con cálculo por separado y los meters de dispensers debajo.
5. Verificar que el puente no se duplique para un mismo día y que el historial anterior permanezca visible.

## Limitaciones de esta fase

- La nueva estructura del puente GNV no transforma automáticamente registros antiguos v0.7 de un solo medidor en tres controles; sus datos siguen guardados como historial.
- La comparación entre puente corregido y dispensers es informativa, no una merma confirmada.
- La v0.7.1 consulta el historial anterior de arqueos para garantizar continuidad. Antes de escalar a años de información, optimizaremos la búsqueda de la última lectura por manguera.
- La compilación completa y los permisos deben validarse en el entorno real de Firebase antes de trabajar con operaciones definitivas.
