# Distrigas Líquidos v0.11.6 — Precio internacional y diferencial ANH / YPFB

**Instalar solo sobre la versión 0.11.5.** Si tu código local contiene modificaciones posteriores, revisarlas antes de extraer el ZIP.

## Alcance
- Configuración: tarifa internacional por GE, GE+, DO, D_ULS y GNV; precio, diferencial oficial de resolución, fecha y hora de vigencia, número de RAR y enlace.
- Meters: «Venta a precio internacional (factura)» en los otros conceptos. Requiere m³/L, número de factura y tarifa internacional válida. El resto del tramo se contabiliza como venta nacional automáticamente. No suma litros adicionales.
- Movimientos: sección de conciliación YPFB por período. Recaudación bruta, parte atribuible a estación, diferencial oficial para YPFB, depósitos documentados y saldo pendiente. Detalle por producto y factura.
- Las operaciones nacionales, vales y arqueos históricos no se reclasifican ni sobrescriben.

## Instalación segura desde PowerShell

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
$archivo = "$env:USERPROFILE\Downloads\distrigasliquidos-precio-internacional-v0.11.6.zip"
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v0115"
New-Item -ItemType Directory -Force "$backup\src" | Out-Null
foreach ($f in @('Config.jsx','MeterBook.jsx','meterMath.js','meterData.js','MovementBook.jsx','gnvRiskMath.js')) {
    Copy-Item "src\$f" "$backup\src\$f" -Force
}
Copy-Item firestore.rules "$backup\firestore.rules" -Force
Expand-Archive -LiteralPath $archivo -DestinationPath (Get-Location).Path -Force
node scripts/install-international-rules-v0116.cjs
node --test tests/international-v0116.test.mjs
npm.cmd run test:meter
npm.cmd run test:movement
npm.cmd run build
```

**Antes del despliegue** comprueba que en `git --no-pager diff -- firestore.rules` sólo se añadan dos bloques: `internationalPriceHistory` e `internationalDeposits`. El instalador crea otro respaldo automático de las reglas. Si la validación muestra cambios inesperados, DETENERSE.

## Publicar en Firebase (solo cuando las pruebas y build terminen bien)

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Con Gerencia, entrar a **Configuración → Precio internacional y diferencial ANH** y registrar la resolución vigente para las fechas de prueba, sin inventar precios. Las tarifas anteriores se conservan. En **Meters → Desglose opcional** elegir `Venta a precio internacional (factura)`, asignar solo litros/m³ del documento y su referencia. En **Movimientos → Precio internacional · diferencial YPFB** seleccionar mes, revisar facturas y registrar un depósito únicamente cuando exista comprobante bancario real.

## Reglas de conciliación
- Importe internacional facturado = volumen facturado × precio final internacional vigente.
- Diferencial estimado YPFB = volumen facturado × **diferencial publicado por ANH**, no necesariamente la simple resta de dos precios de pantalla.
- Importe atribuible a estación = importe internacional facturado − diferencial oficial.
- Pendiente por conciliar = diferencial estimado − depósitos registrados para ese período.
- No hay transferencia bancaria automática.
- Solo cuentan facturas internacionales **marcadas expresamente** en el desglose y asociadas a arqueos vigentes.
- Deben verificarse el régimen aplicable, el precio oficial vigente, las facturas y la documentación antes de realizar una liquidación real.

La comprobación de duplicados de factura está en el cliente para evitar errores ordinarios; **no es todavía una garantía transaccional para dos operadores concurrentes**. Para despliegue operativo real debe implementarse un índice de facturas único controlado desde el servidor y validación formal de importes y depósitos. En GNV pueden existir obligaciones de facturación por terceros según régimen; revisar el caso con la documentación vigente.

## Reversión
Se conservan los archivos originales en `distrigasliquidos-respaldo-v0115` y se crea una copia de `firestore.rules` antes de insertar las reglas. No borres documentos de Firestore para revertir una interfaz.
