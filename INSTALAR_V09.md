# Distrigas Líquidos v0.9 — Meters horizontales y estimación de mezcla

**Base:** proyecto que ya tiene publicada v0.8.1. Este paquete NO contiene `.env`, configuración ni scripts que borren Firebase.

## Qué cambia

- Meters por familia: gasolinas GE/GE+ comparten la misma planilla y mangueras; DO/D-ULS comparten su planilla cuando corresponde. GNV conserva el puente y los dispensers.
- En cada fila se muestran los meters **iniciales solo lectura**; solo se escriben los **finales** y la hora. La opción `+ Otro turno` permite registrar lecturas intermedias de una manguera sin exigir datos de otras.
- Se conserva el producto facturado en cada intervalo y el precio vigente. Las recepciones se identifican con colores en la vista de meters.
- En Recepciones, al seleccionar tanque, el producto anterior por defecto se infiere de la última descarga registrada de ese tanque, si existe.
- En Movimientos, vista auxiliar de composición **estimada** por tanque mediante mezcla homogénea proporcional, con secuencia de ingresos y salidas; muestra alertas si falta información o las mangueras alimentan múltiples tanques sin distribución.
- Nunca modifica el producto declarado en la factura ni reemplaza la conciliación física nocturna. Un modelo de mezcla no mide composición real ni garantiza cumplimiento normativo.

## Instalación en Windows PowerShell

1. Descarga `distrigasliquidos-meters-mezcla-v0.9.zip` a Descargas. Cierra el proceso `npm run dev` si lo hay.
2. En PowerShell:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$archivo = "$env:USERPROFILE\Downloads\distrigasliquidos-meters-mezcla-v0.9.zip"
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v081-antes-v09"

if (!(Test-Path $archivo)) { throw "No se encontró el ZIP en Descargas" }
New-Item -ItemType Directory -Path "$respaldo\src" -Force | Out-Null
foreach ($f in @('App.jsx','MeterBook.jsx','MovementBook.jsx','ReceptionBook.jsx','meter.css','movement.css')) {
  Copy-Item "$proyecto\src\$f" "$respaldo\src\$f" -Force
}

Expand-Archive -LiteralPath $archivo -DestinationPath $proyecto -Force
cd $proyecto
node --test tests/mixed-tank.test.js
npm.cmd run test:meter
npm.cmd run test:movement
npm.cmd run build
```

3. **Solo si** `npm.cmd run build` termina sin errores:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

4. Verifica en `https://distrigasliquidos.web.app` que GE y GE+ estén en una sola sección, que los iniciales estén visibles y los finales sean editables, y que el modelo de mezcla esté debajo de Movimientos por familia. Después sube el código:

```powershell
git add src/App.jsx src/MeterBook.jsx src/MovementBook.jsx src/ReceptionBook.jsx src/meter.css src/movement.css src/mixedTankEstimate.js tests/mixed-tank.test.js INSTALAR_V09.md
git commit -m "Distrigas Liquidos v0.9 - Meters horizontales y mezcla estimada"
git push
```

## Precauciones

- No hace falta cambiar reglas de Firestore ni eliminar registros anteriores.
- No borres datos iniciales ni cambies fechas. El sistema leerá los existentes.
- Si el build falla, **no publiques**. Envía el error completo.
- Para validar la estimación compara 1–2 jornadas contra la matriz. Si una manguera recibe combustible de varios tanques, se señala como no asignable y se requiere información adicional.
- La identificación de mezcla por grado es una **estimación administrativa**; nunca se debe utilizar para certificar el producto despachado ni autorizar mezclas incompatibles.
