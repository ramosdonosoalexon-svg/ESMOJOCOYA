# Distrigas Líquidos – v0.7 · Meters, arqueos y precios por producto

## Qué incluye

- **Configuración → Precios vigentes**: precios en bolivianos por litro o m³ para cada producto activo, con **fecha y hora de vigencia**. Historial inmutable. El precio se guarda junto al despacho.
- **Meters / Arqueos**: un apartado por producto habilitado, con 4 fechas (2 anteriores, día editable y día siguiente); cuadricula por manguera y registro de turnos independientes mediante «+».
- Registro de medidor **mecánico y digital** por manguera sin sumarlos. Se elige el medidor principal para los cálculos.
- **Desglose de un mismo intervalo** entre venta, entrega prepago, entrega postpago, consumo propio, calibración devuelta, calibración vendida y otras salidas. El desglose debe cuadrar el meter principal.
- **GNV**: los meters de manguera se registran en m³ y hay un registro separado del puente de regulación. Se guardan sus lecturas sin inventar fórmulas de conversión.
- Anulación administrativa sin borrado físico, conservando motivos.
- Los mismos tanques/mangueras pueden cambiar entre GE/GE+ o DO/D-ULS sin sumar inventarios físicos separados del tanque.

## Antes de empezar

La v0.6.4 debe estar instalada. Descarga `distrigasliquidos-meters-precios-v0.7.zip` a `Descargas`. Cierra el servidor local con `Ctrl+C`.

## 1. Respaldar, actualizar y verificar

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v064"
New-Item -ItemType Directory -Path "$respaldo\src" -Force | Out-Null
Copy-Item "$proyecto\src\App.jsx", "$proyecto\src\Config.jsx" -Destination "$respaldo\src" -Force
Copy-Item "$proyecto\firestore.rules", "$proyecto\package.json" -Destination $respaldo -Force
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-meters-precios-v0.7.zip" -DestinationPath $proyecto -Force
cd $proyecto
npm.cmd install
npm.cmd run test:meter
npm.cmd run test:reception
npm.cmd run build
```

Si `npm.cmd run build` presenta errores, **no publiques**. Comparte el error completo antes de continuar.

## 2. Publicación en Firebase

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

La actualización publica reglas para `priceHistory`, `meterShifts` y `gnvBridge`, y reemplaza las reglas del proyecto. **No borra registros**, pero el despliegue afecta permisos: probar con cuentas ficticias de propietario, administrador y operador antes de uso real.

## 3. Prueba guiada

1. Inicia sesión como propietario o administrador.
2. Abre Configuración → Precios vigentes y registra un precio de prueba de uno de los productos activos con fecha/hora.
3. Abre Meters / arqueos; selecciona una fecha que sea posterior a los Datos iniciales.
4. Registra en una manguera meter inicial y final y guarda.
5. Usa «+ Agregar otro turno» solo en esa manguera. Las demás no deben alterarse.
6. En «Desglosar» registra venta / prepago / postpago, comprobando que sumen el volumen total.
7. Verifica el precio aplicado y que no cambie al registrar otro precio posterior.
8. Para GNV, prueba un registro de meter por manguera y un registro del puente de regulación por separado.

## 4. GitHub

```powershell
git add package.json firestore.rules src/App.jsx src/Config.jsx src/PriceSettings.jsx src/MeterBook.jsx src/meter.css src/priceMath.js src/meterMath.js src/meterData.js tests/meter.test.js INSTALAR_V07.md
git commit -m "Distrigas Liquidos v0.7 - Meters, arqueos y precios con vigencia"
git push
```

`INSTALAR_V07.md` se incluye para documentar esta versión. No subas `.env`.

## Alcance y pendientes

- El desglose de entregas prepago y postpago registra volumen, cliente y valor, pero **todavía no genera un estado de cuenta, no comprueba saldo prepago y no registra cobros**. Se hará en un módulo comercial específico.
- Las ventas durante una recepción se capturan en Recepciones para su conciliación de transporte y **no deben contarse nuevamente como una venta adicional** al consolidar el libro diario de Meters.
- Las fórmulas avanzadas de conciliación del puente de GNV y Movimientos se implementarán después de validar las fórmulas de la matriz.
- Este paquete es para **pruebas**: antes de contabilizar operaciones reales es necesario completar cierres diarios, validaciones de servidor e informes de conciliación.
