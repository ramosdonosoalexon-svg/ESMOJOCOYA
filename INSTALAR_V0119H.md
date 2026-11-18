# Distrigas Líquidos v0.11.9h — fechas sin horarios retroactivos

Se aplica **después de v0.11.9g**. Este parche cambia exclusivamente los archivos del piloto de operadores: `OperatorPilot.jsx`, `operatorPilotUX.js`, `operatorPilotMath.js` y `operatorPilotData.js`. Se conservan el GLB, menús, reglas Firestore, reportes y datos.

## Comportamiento

- **Fecha anterior a hoy**: solo fecha. No aparecen campos Inicio/Fin y no se necesitan para guardar ni enviar el arqueo.
- **Fecha de hoy**: el inicio se toma del reloj del teléfono al abrir `+ Mi turno` o cuando se cambia la fecha a hoy; el cierre se toma al pulsar `Cerrar y enviar`. No se editan manualmente.
- Los meters retroactivos se registran con la **fecha sin hora** para que sean recuperables en días posteriores. No se utilizan para conciliaciones minuto-a-minuto entre operadores, porque se desconoce el horario.
- Nunca se sobreescriben los registros de Meters oficiales ni los reportes ANH. Los cambios son únicamente en arqueos de prueba.
- El instalador comprueba la versión exacta de los cuatro archivos y, si no coincide, se detiene antes de reemplazar nada. Guarda respaldos `.before-v0119h`.

## Instalar en Windows PowerShell

Descarga el ZIP a `Descargas` y ejecuta:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-turnos-fecha-v0.11.9h.zip" -DestinationPath (Get-Location).Path -Force
node .\scripts\install-operator-time-v0119h.cjs
node --test .\tests\operator-time-v0119h.test.mjs
node --test .\tests\operator-pilot-v0119.test.mjs
npm.cmd run build
```

Si todas las pruebas y la compilación terminan correctamente, publica:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

En Android abre la página y recarga si fuera necesario. Selecciona ayer o una fecha anterior: debe verse solo `Fecha`; al elegir hoy, debe aparecer hora de inicio automática, con hora de fin automática al enviar.

**Nota**: Para fechas retroactivas con varios turnos el mismo día, no se puede inferir con seguridad el orden real sin horas. Por ello la lectura sugerida usa cierres de días anteriores, no afirma reconciliación horaria ni inventa una secuencia.

**No se ha publicado ni probado contra una cuenta real de Firebase.** Se recomienda verificar el flujo en Android antes de introducir datos de producción.
