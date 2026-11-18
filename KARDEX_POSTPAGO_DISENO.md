# Diseño propuesto – Kardex Postpago (aún no implementado)

## Basado en el Excel de vales de octubre 2026

El libro contiene hojas separadas por empresa/institución. Entre los encabezados encontrados están: institución, estación de servicio, fecha de carguío, placa, factura, número de vale, producto (en algunas hojas), volumen, precio unitario y total. **No se debe deducir el producto solo por precio** si falta una columna; debe verificarse con factura/facturador.

## Flujo propuesto

1. **Catálogo de clientes de crédito**: institución, contrato, vigencia, estaciones autorizadas, personas autorizadas, placas autorizadas cuando aplique, límite de crédito y condiciones de pago. Evitar guardar datos personales innecesarios.
2. **Carga postpago**: el operador selecciona el cliente, captura o escanea factura/QR (si hay un formato técnico disponible), y confirma los datos detectados: estación, fecha/hora, factura, vale, producto, placa, litros/m³, precio e importe. Si el escaneo no interpreta campos, completar manualmente. La foto es evidencia, no sustituto del registro verificado.
3. **Validación**: detectar posibles duplicados por estación/emisor + número de factura y número de vale; advertir en vez de sumar dos veces. Comparar con las ventas o clasificación postpago de Meters cuando existan para evitar descontar inventario otra vez.
4. **Kardex**: un registro por despacho, con cliente, estación, estado y trazabilidad del operador. Búsqueda y filtros por empresa, placa, producto, fecha, factura y vale.
5. **Conciliación mensual**: resumen por cliente, estación y producto. Marcar despacho como conciliado al confirmar con la institución; registrar diferencias y sus resoluciones.
6. **Cuenta por cobrar**: emitir relación/cuenta de cobro; registrar pagos totales o parciales, saldos pendientes, fechas de vencimiento y comprobantes, siempre con historial de cambios.
7. **Entrega al cliente**: un resumen PDF/Excel o portal del cliente con los despachos conciliados. Enviar información por canales autorizados, no automáticamente a contactos no validados.
8. **Integración futura**: usar Facturito/GOTA solo si hay API o exportación autorizada, vinculando el documento al registro; no abrir los equipos locales a Internet.

## Estados recomendados

- Capturado → Por verificar → Verificado → Conciliado → Presentado a cobro → Parcialmente cobrado / Cobrado.
- Observado o Anulado con motivo y auditoría, sin eliminación silenciosa.

## Controles esenciales

- Una factura **no crea por segunda vez** un despacho en Meters: el kardex es el documento comercial y la cuenta por cobrar vinculados al despacho.
- El importe se toma de la factura y del precio vigente cuando corresponda, sin recalcular retroactivamente documentos históricos.
- Un mismo cliente puede abastecerse en varias estaciones; el cliente es global y cada despacho conserva su estación.
- La conciliación distingue *combustible entregado*, *monto facturado* y *monto cobrado*.
- El paso a cobranza requiere autorización cuando hay diferencias contra la relación oficial del cliente.

## Primer prototipo sugerido

Primera fase: carga manual con lector de QR o fotografía como respaldo, comprobación de duplicados, kardex único, resumen mensual y exportación Excel/PDF. Después, conexión con Facturito si está habilitada por la entidad responsable.
