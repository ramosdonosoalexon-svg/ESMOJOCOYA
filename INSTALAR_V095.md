# Distrigas Líquidos v0.9.5 — Meters muestra los arqueos existentes

## Problema identificado

En `src/MeterBook.jsx` la variable `refresh` arrancaba en `0` y estaba en las dependencias de `useDocuments`. El hook `src/hooks.js` omite la suscripción si encuentra alguna dependencia falsy (`deps.some(x => !x)`); por eso Meters no descargaba los registros aunque Movimientos sí los mostrase. El intento de reingresar un arqueo existente detectaba el documento con `getDoc`, generando el aviso de duplicado.

## Corrección

Se cambia solamente `refresh` inicial de `0` a `1` en `MeterBook.jsx`. La suscripción se establece desde la primera carga y continúa actualizándose al guardar o anular. No se modifican las reglas, los registros, las credenciales, los saldos ni la API de Firebase.

## Instalación en Windows

1. Descargar el archivo ZIP en Descargas.
2. Ejecutar PowerShell:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Copy-Item .\src\MeterBook.jsx .\src\MeterBook.jsx.respaldo-v094 -Force
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-meters-v0.9.5.zip" -DestinationPath "$env:USERPROFILE\distrigasliquidos" -Force
node --test .\tests\meter-subscription.test.mjs
npm.cmd run build
```

3. SOLO si `npm.cmd run build` termina sin errores:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

4. En el navegador recargar el sitio (Ctrl + Shift + R), seleccionar la estación de las pruebas y abrir Meters, 01/11/2026. Las lecturas ya guardadas deben verse en la tabla por manguera y el total debe coincidir con Movimientos.

No volver a registrar arqueos históricos. Si Meters muestra error de consulta luego de este cambio, revisar el mensaje concreto en pantalla; no modificar Firestore manualmente.
