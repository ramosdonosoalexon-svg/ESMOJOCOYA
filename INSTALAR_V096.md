# Distrigas Líquidos v0.9.6 — Vales, clasificación de salidas y saldo automático

## Contenido
Parche incremental para una instalación que ya ejecuta v0.9.5. Conservar los registros de Firestore. No borra documentos.

Archivos incluidos:
- `src/MeterBook.jsx`: desglose <= meter, venta automática de la diferencia, vinculación de cuenta de vales.
- `src/meterMath.js`: nueva conciliación y categoría de limpieza.
- `src/MovementBook.jsx` y `src/movement.css`: detalle por conceptos en Movimientos.
- `src/voucherMath.js`, `src/voucherData.js`, `src/VoucherLedger.jsx`, `src/voucher.css`: cuentas, abonos y cobros.
- `firestore.rules`: reglas nuevas exclusivamente para cuentas y cobros/recargas de vales; conserva las reglas existentes.
- `tests/vouchers-v096.test.js`: pruebas nuevas.

## Instalar con PowerShell (Windows)

Descarga `distrigasliquidos-vales-salidas-v0.9.6.zip` en Descargas.

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$archivo = "$env:USERPROFILE\Downloads\distrigasliquidos-vales-salidas-v0.9.6.zip"
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v095"

if (!(Test-Path $archivo)) { throw "No encontré $archivo. Revisa la carpeta Descargas." }
cd $proyecto
New-Item -ItemType Directory -Path "$backup\src" -Force | Out-Null
Copy-Item .\firestore.rules "$backup\firestore.rules" -Force
foreach ($f in @('MeterBook.jsx','meterMath.js','MovementBook.jsx','movement.css')) {
  Copy-Item "src\$f" "$backup\src\$f" -Force
}
Expand-Archive -LiteralPath $archivo -DestinationPath $proyecto -Force

node --test .\tests\vouchers-v096.test.js
npm.cmd run test:meter
npm.cmd run test:movement
npm.cmd run build
```

**Si alguna prueba o `npm.cmd run build` falla, NO desplegar.** Envía el error. Compara las reglas antes de publicar:

```powershell
git --no-pager diff --no-index --stat "$backup\firestore.rules" .\firestore.rules
```

Una diferencia `1` de Git significa que los archivos tienen cambios; no es necesariamente un error.

**Después de comprobar**, publicar las reglas antes de publicar la interfaz:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Actualizar con Ctrl+Shift+R.

## Prueba sugerida

1. Abre «Libro de meters y arqueos» en la estación de pruebas.
2. Desplázate a «Vales de clientes · prepago y postpago».
3. Crea cuenta «Policía» con modalidad «Prepago»; registra el abono **real** recibido (p. ej. Bs 3.000 si ese importe fue efectivamente pagado). Para pruebas inventadas, usa exclusivamente datos claramente ficticios de la estación de pruebas.
4. Ve a una manguera cuyo arqueo de prueba aún no exista; no edites ni dupliques el 1/11 ya registrado.
5. Escribe un final que produzca 584,91 L de despacho, despliega «Desglose opcional», añade 300 L prepago y otros 10 L prepago para esa cuenta, agrega la referencia del vale.
6. Comprueba la vista: «Venta normal automática: 274,91 L».
7. Guarda. El saldo prepago debe bajar Bs 2.157,60 con precio Bs 6,96/L. Movimientos registra 584,91 L de salida, no 894,91 L.
8. Para postpago crea otra cuenta, registra entregas y luego el cobro mensual mediante el formulario «Registrar dinero recibido»; el cobro no modifica inventario.
9. Verifica «Detalle» de Movimientos: limpieza y calibración devuelta se clasifican separadamente; solo calibración devuelta reduce la salida neta.

## Importante antes de producción

La cuenta de vales **es una implementación para pruebas funcionales**. Los saldos se calculan desde arqueos y abonos históricos y se comprueban en el navegador. Esto no garantiza protección contra dos operadores que despachen **simultáneamente** contra un mismo saldo prepago. Antes de usarlo para cobros reales y varias cajas, debe añadirse una validación atómica/transaccional en el servidor y controles de cierre y corrección de pagos. Los ingresos de caja no son los mismos que la valorización de litros despachados.

El sistema NO vincula automáticamente vales históricos que no tengan `voucherAccountId`; requieren conciliación autorizada para evitar atribuciones erróneas.
