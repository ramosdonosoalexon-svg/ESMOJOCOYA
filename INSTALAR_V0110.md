# Distrigas Líquidos v0.11.0 — Gasolinas en conjunto

Actualización incremental sobre **v0.10.1**. No contiene `.env`, credenciales ni datos personales.

## Alcance

- **Movimientos:** una vista principal «Gasolinas · movimiento conjunto» (GE + GE+). El total de meters se toma una sola vez desde los arqueos guardados.
- **Recepciones:** GE identificado en negro y GE+ en café; los importes de 12.000 y 10.000 L se presentan en sus fechas reales si constan así en Firebase.
- **Saldo final físico:** sigue siendo el inventario medido a medianoche, no la suma inventada de subproductos. Las mermas y demasías siguen calculándose en la tabla conjunta y conservan rojo/verde.
- **Ojo por día:** muestra la separación contable (según producto facturado) y un modelo **teórico** de mezcla; el reparto físico ilustrativo se calcula aplicando esos porcentajes al físico medido, sin modificar registros.
- **Filtros:** Conjunto / Solo GE / Solo GE+. Una venta de GE por un meter compartido no se replica como GE+ automáticamente.
- **Inventario:** tanque compartido de gasolinas con segmentos negro/café, gráfico de porcentaje y marcadores históricos diarios por fecha. Un solo saldo físico en la tabla de inventario.
- **Seguridad:** únicamente UI y funciones de consulta/cálculo; no modifica firestore.rules, recepciones, inventarios ni meters.

**Aviso:** la distribución de colores es una estimación de composición (modelo de mezcla homogénea), no medición química, prueba de especificación ni permiso para comercializar un combustible distinto al facturado. Cuando faltan datos o la manguera alimenta varios tanques, la estimación puede ser incompleta; revisar alertas en el detalle.

## Instalar en PowerShell (Windows)

1. Descargar `distrigasliquidos-gasolinas-conjunto-v0.11.0.zip` en `Descargas`.
2. Abrir PowerShell y ejecutar:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$archivo = "$env:USERPROFILE\Downloads\distrigasliquidos-gasolinas-conjunto-v0.11.0.zip"
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v0101-antes-v0110"

if (!(Test-Path $archivo)) { throw "No se encuentra el ZIP en Descargas: $archivo" }
Set-Location $proyecto
foreach ($f in @('App.jsx','Operations.jsx','MovementBook.jsx','movementMath.js',
'movement.css','inventoryVisual.css','inventoryWindow.js','gasolineVisual.js')) {
  if (Test-Path "src\$f") {
    New-Item -ItemType Directory -Force "$backup\src" | Out-Null
    Copy-Item "src\$f" "$backup\src\$f" -Force
  }
}
Expand-Archive -LiteralPath $archivo -DestinationPath $proyecto -Force
node --test .\tests\gasoline-visual-v0110.test.mjs .\tests\gasoline-family-v0110.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas. No publiques.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Falló Vite. No publiques.' }
```

3. Solo si las pruebas y el build terminan correctamente:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

4. Refrescar `https://distrigasliquidos.web.app` con Ctrl + Shift + R. Verificar en Noviembre 2026:
  - 08/11: saldo físico de GE y su color principal negro (si no había GE+ contabilizada).
  - 09/11: recepción GE+ de 12.000 L en café y gráfico histórico con ambos colores si había remanente GE.
  - 10/11: recepción GE+ de 10.000 L en café, con más presencia de café en la estimación.
  - El saldo físico nocturno debe coincidir con Inventario y los meters no deben sumarse dos veces.
  - El ojo permite consultar estimaciones y saldos contables por separado.
  - Mermas negativas siguen rojas; demasías positivas siguen verdes.

5. Si todo funciona, guardar en GitHub:

```powershell
git add src/App.jsx src/Operations.jsx src/MovementBook.jsx src/movementMath.js src/movement.css src/inventoryVisual.css src/inventoryWindow.js src/gasolineVisual.js tests/gasoline-visual-v0110.test.mjs tests/gasoline-family-v0110.test.mjs
git commit -m "v0.11.0: gasolinas compartidas con vista conjunta y colores"
git push
```

**No se ha desplegado desde aquí.** La compilación completa con Vite y las pruebas con Firestore real se realizan en el equipo autorizado antes de publicar.
