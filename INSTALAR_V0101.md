# Distrigas Líquidos v0.10.1 — Recepciones: saldo físico ANTES de descargar

## Corrección conceptual

El **saldo del inicio del día (00:00)** es diferente del **saldo físico inmediatamente antes de la descarga**.

Esta recepción utiliza el volumen obtenido de la **medición antes de la descarga (mm)** con la tabla de calibración activa del tanque (`startVolumeL`). No vuelve a restar ventas previas a esa medición. Solo se agregan a la ecuación los despachos que ocurren **durante** la descarga cuando se aportan esos meters, con su validación de cobertura.

**Ejemplo:** medición previa 1.333 mm = 17.119 L: la caja naranja debe mostrar 17.119 L, no una reconstrucción de 8.069,95 L desde Datos iniciales.

Este saldo físico es del TANQUE COMPLETO y **no demuestra cuántos litros contables de GE o GE+ lo componen**. Por ello esta versión deja `oldProductAccountingL: null` en recepciones nuevas de cambio de producto; las cuentas por producto se tratan en Movimientos y no se inventa una composición. Los valores históricos no se modifican.

La observación/autorización de cambio continúa opcional. Si se omite, se guarda nota de ausencia de observación; no se inventa autorización. Los campos de tabla `startVolumeL` y `endVolumeL` se guardan como antes. NO modifica reglas ni registros de Firestore.

## Instalación

Requiere v0.10.0 instalado. Descargar ZIP en Descargas:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"

$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v0100\src"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item .\src\ReceptionBook.jsx "$backup\ReceptionBook.jsx" -Force

Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-recepciones-antes-descarga-v0.10.1.zip" -DestinationPath "$env:USERPROFILE\distrigasliquidos" -Force

node --test .\tests\reception-before-unload-v0101.test.mjs
npm.cmd run build
```

Si ambos comandos finalizan correctamente:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Luego recarga con Ctrl+Shift+R y revisa una **fila nueva sin guardar** del 10/11. La caja debe coincidir con el saldo en litros calculado desde la altura **antes** de descargar. No anules ni recrees recepciones ya guardadas; la modificación es solo del formulario y su cálculo para nuevos registros.

Nota: Esta versión no resuelve la distribución química ni fiscal de existencias de un tanque mixto. La lectura física es el TOTAL del tanque.
