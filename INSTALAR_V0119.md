# Distrigas Líquidos v0.11.9 · Arqueo del operador — MODO PRUEBAS

## Alcance
- Administración y Gerencia activan/desactivan **por estación** en la nueva pestaña «Arqueos operadores · pruebas».
- Los operadores autenticados ven directamente un panel móvil sencillo con: apertura de turno, lecturas iniciales/finales por manguera, vales prepago/postpago, consumos propios, calibración, cobros QR/tarjeta, efectivo contado, diferencia de caja y **corte de medianoche**.
- Guardado persistente del borrador **en el dispositivo** (IndexedDB). Tras recuperar conexión, se comparte para revisión en **colecciones independientes de Firestore**. Los dos operadores ven la conciliación/diferencia de la misma manguera cuando sus lecturas están sincronizadas.
- Administración/Gerencia marcan un registro como «revisado» u «observado», sin convertirlo en movimiento oficial.
- El operador puede **imprimir el arqueo** o elegir «Guardar como PDF» desde el diálogo del navegador. Incluye marca «NO CONTABILIZADO · NO OFICIAL».
- **No escribe** en `meterShifts`, `receptions`, `inventories`, `movementNotes`, `voucherAccounts` ni otras colecciones oficiales. No activa sincronización a la contabilidad, octano, ANH ni Sustancias Controladas.

## Límites de esta primera prueba
- Es una **web móvil instalable en Android (PWA)**, aún **NO** un archivo APK nativo. La primera visita debe hacerse con conexión, con la sesión del operador iniciada. Después, si el dispositivo conserva su caché y almacenamiento, podrá seguir guardando borradores aunque pierda señal.
- Alertas y vibración de medianoche **con la pantalla de la app abierta** (23:30, 23:50 y alrededor de 00:00). La vibración/notificación con el dispositivo bloqueado y la app cerrada requiere el módulo Android nativo programado para la siguiente etapa; no se debe confiar exclusivamente en la alerta web durante el piloto.
- No se ha conectado Facturito ni se escanean aún facturas QR. Los vales se registran inicialmente con cliente, referencia y cantidad; el lector de factura se agregará más adelante.
- Los importes se estiman con precios configurados o ingresados en el arqueo. Si faltan precios o hay discrepancias, son **advertencias para revisión**, no cifras validadas.
- Los cortes de medianoche guardan la **lectura observada y hora real**, sin inventar lecturas a las 00:00. Las mangueras inactivas quedan disponibles para la revisión del mismo sector. No hay asignación por GPS.
- Los cierres de prueba **no reemplazan** los arqueos del administrador durante esta fase. Si un móvil se extravía, los borradores no sincronizados y guardados solo allí podrían perderse. Recomendar sincronizar para revisión al final del turno y conservar el comprobante impreso.

## Instalación Windows PowerShell

Guardar `distrigasliquidos-operadores-piloto-v0.11.9.zip` en **Descargas**. Se aplica sobre la v0.11.8; no reemplaza `App.jsx`, `index.html` ni `firestore.rules` completos.

```powershell
cd "$env:USERPROFILE\distrigasliquidos"

# Respaldo previo a modificaciones
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v0118"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item .\src\App.jsx "$backup\App.jsx" -Force
Copy-Item .\firestore.rules "$backup\firestore.rules" -Force
Copy-Item .\index.html "$backup\index.html" -Force

# Agregar archivos del piloto
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-operadores-piloto-v0.11.9.zip" -DestinationPath (Get-Location).Path -Force

# Integrar solo el menú, caché de sesión de operador y permisos exclusivos del piloto
node .\scripts\install-operator-pilot-v0119.cjs
node .\scripts\install-operator-pilot-rules-v0119.cjs

# Prueba específica
node --test .\tests\operator-pilot-v0119.test.mjs

# Compilación completa: imprescindible para publicar
npm.cmd run build
```

## Seguridad antes de publicar

Examinar cambios de reglas frente a lo que **realmente había en tu PC antes de instalar**:

```powershell
git --no-pager diff --no-index "$backup\firestore.rules" .\firestore.rules
```

Git puede devolver código 1 porque hay diferencias; es normal. Solo deben añadirse tres bloques: `operatorPilotSettings`, `operatorPilotShifts`, `operatorPilotReadings`, y las funciones auxiliares. **No se debe modificar ni abrir el acceso a `meterShifts`.** Si hay cambios adicionales o errores, **no publicar**.

## Despliegue en orden

**Solo si** el instalador y `npm.cmd run build` terminaron sin errores y has comprobado las reglas:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

La actualización no ha sido publicada desde aquí. Hay que comprobar la autorización efectiva de Firebase con cuentas de prueba.

## Prueba inicial con dos operadores

1. Gerencia o Administración: elegir la estación, abrir **Arqueos operadores · pruebas** y pulsar **Activar pruebas**.
2. Operador saliente: iniciar sesión desde Android, abrir **Mi turno**, añadir mangueras y registrar sus iniciales. Guardar borrador. Al salir, registrar los finales y su cuadre; enviar para revisión e imprimir.
3. Operador entrante: registrar independientemente sus iniciales en las mismas mangueras y guardar. Las lecturas se compararán cuando ambas lleguen a Firebase. Si hay diferencia, se mostrará sin alterar las lecturas.
4. Probar una manguera sin ventas: sus iniciales y finales deberán ser iguales; no se inventarán litros despachados.
5. Probar sin internet después de cargar la app online: guardar y cerrar un borrador en el dispositivo, recuperar señal, enviar pendientes y verificar que aparezca en Gerencia.
6. Probar el **corte de medianoche** y añadir las mangueras sin uso del sector; los cortes no cierran el turno ni afectan los reportes oficiales.
7. Gerencia revisa los registros y marca **Revisado** u **Observado**. En Meters oficial y Movimientos no deben aparecer los datos nuevos del piloto.
8. Desactivar las pruebas por estación: no deben borrarse documentos; el operador no puede enviar nuevos registros mientras esté deshabilitado.

## Pruebas efectuadas al preparar el paquete

- 10 pruebas nuevas de cálculos y conciliación; 30 pruebas de regresión de Meters/GNV/Movimientos pasan.
- Revisión sintáctica de App.jsx y OperatorPilot.jsx con parser de TypeScript/JSX.
- Instalador aplicado **dos veces** a una copia de la v0.11.8: no duplica pestañas ni bloques de permisos.
- No se completó compilación Vite en el contenedor porque no estaban disponibles las dependencias NPM; queda pendiente en tu PC.
- Firestore real y notificaciones Android en segundo plano **no han sido probados**.
