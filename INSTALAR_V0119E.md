# Distrigas Líquidos — v0.11.9e: Mi turno simplificado y QR de facturas

## Incluye

- Pantalla operativa de operador más corta: `+ Mi turno`, `00:00`, historial, estado reducido, y editor separado en **Meters / Vales / Caja**.
- Hora de inicio automática cuando se inicia un turno **del día actual**; al pulsar «Cerrar y enviar» se registra la hora local del dispositivo. En pruebas de días anteriores, el usuario indica fecha y horas de forma explícita (no se inventan registros históricos). No se permiten fechas futuras.
- Selección táctil de mangueras por tarjetas. La lectura inicial se sugiere tomando la última lectura `final` o `medianoche` del piloto anterior a la hora del turno; si no existe, intenta la colección `initialMeters` configurada. Se señala el origen y el operador puede corregirlo. Si Firestore no permite leer `initialMeters` al rol operador, la primera lectura se introduce manualmente y las posteriores podrán aprovechar las lecturas compartidas del piloto. Nunca toma una lectura del futuro para un día histórico.
- Vales **prepago o postpago**: botón «Escanear QR», cámara trasera y opción de fotografiar la factura o pegar el enlace QR. Reconoce URL del SIAT con `nit`, `cuf`, `numero` y la variante antigua `var1/2/3`; autocompleta referencia, NIT emisor, CUF y número de factura. El operador confirma manualmente tipo de vale, cliente, producto y cantidad.
- La lectura QR se hace en el navegador con la librería gratuita `@zxing/browser`; no se sube la imagen a servicios de terceros. La cámara requiere HTTPS o localhost.
- Los datos del piloto permanecen en `operatorPilotShifts` / `operatorPilotReadings`. **No modifica Meters oficiales, facturación, cuentas de clientes ni reglas de seguridad.**

## Instalar en la PC Windows (PowerShell)

Este parche presupone el piloto de arqueos v0.11.9 y es compatible con la navegación v0.11.9d. El instalador comprueba el archivo original exacto y aborta sin sobrescribir si fue modificado en tu PC.

Descargar `distrigasliquidos-operador-ux-v0.11.9e.zip` en `Descargas`.

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-operador-ux-v0.11.9e.zip" -DestinationPath (Get-Location).Path -Force
node .\scripts\install-operator-ux-v0119e.cjs
npm.cmd install @zxing/browser
node --test .\tests\operator-ux-v0119e.test.mjs .\tests\operator-pilot-v0119.test.mjs
npm.cmd run build
```

**No publiques si el instalador, las pruebas o el build fallan.** Si todo pasa:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Actualiza el navegador Android / iPhone con recarga de la página.

## Prueba breve

1. Inicia sesión con operador habilitado. Debes ver **Mi turno** y las opciones mínimas.
2. Pulsa `+ Mi turno`, comprueba la hora real y selecciona una manguera. Si hay una lectura final previa sincronizada, el inicial aparece sugerido con su origen. Si no, comprueba si lee el valor de Datos iniciales; si falla por permisos, escribe el inicial manualmente (sin alterar las reglas).
3. En **Vales**, añade un vale prepago o postpago y escanea una factura con QR SIAT real. Verifica NIT emisor, CUF y número, y completa los datos ausentes. No se valida todavía la factura contra el SIN ni se consulta automáticamente Facturito.
4. En **Caja**, registra el efectivo y el resto de cobros. Pulsa `Cerrar y enviar`; se toma la hora del dispositivo y se conserva la rendición en el piloto.
5. Para pruebas de noviembre anteriores a hoy, cambia fecha *antes* de elegir mangueras y rellena inicio y fin históricos.

## Limitaciones conocidas

- Las lecturas compartidas son del **piloto**, no del libro oficial. Para garantía plena de lectura inicial desde `meterShifts` hará falta un mecanismo administrado de publicación de últimas lecturas, sin exponer reportes ni contabilidad al operador. No se han abierto permisos nuevos en Firestore.
- El QR fiscal de SIAT no certifica si la venta es prepago o postpago, ni siempre contiene datos de comprador, producto, litros o importe. Facturito/XML requerirá una conexión posterior y pruebas con facturas de ese proveedor.
- El moldeado 3D real de Blender no está incorporado en esta versión: se incluyó un selector táctil ligero de mangueras. Una integración 3D se puede construir como módulo opcional una vez confirmadas las marcas/modelos y asignación de mangueras de cada dispenser.
- La compilación y la cámara no se han verificado en tu equipo ni en teléfonos reales. Los tests automáticos comprueban únicamente la lógica aislada.
