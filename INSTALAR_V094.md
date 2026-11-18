# Distrigas Líquidos v0.9.4 – Diagnóstico de Meters y protección contra duplicados

Este parche NO cambia Firebase ni crea/modifica/borrar documentos de Firestore por sí mismo.
Requiere instalado v0.9.2 (la v0.9.3 solo cambia reglas).

Archivos actualizados: src/MeterBook.jsx (panel diagnóstico solo lectura) y src/meterData.js (comprobación de duplicados antes de guardar).

## Instalar en PowerShell

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
New-Item -ItemType Directory -Force "$env:USERPROFILE\distrigasliquidos-respaldo-v093\src" | Out-Null
Copy-Item .\src\MeterBook.jsx, .\src\meterData.js -Destination "$env:USERPROFILE\distrigasliquidos-respaldo-v093\src"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-diagnostico-meters-v0.9.4.zip" -DestinationPath "$env:USERPROFILE\distrigasliquidos" -Force
npm.cmd run build
```

Solo si la compilación concluye satisfactoriamente:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

## Comprobar

Abrir Meters, seleccionar 2026-11-01, desplegar “Diagnóstico de sincronización de Meters (solo lectura)” y comparar el ID de manguera del arqueo con el de Configuración.
- Si indica 0 lecturas del día, comprobar la estación seleccionada o la consulta a Firestore.
- Si aparece “SIN VINCULAR”, corregir la asociación histórica de manera controlada, sin borrar el documento original.
- Si el documento aparece vinculado, verificar que el resumen lo incluya por producto y fecha.
- Si al guardar avisa de arqueo existente, no volver a escribirlo; el ID es fecha + manguera + secuencia.

No cambies `role=owner` ni `stationId=null` del usuario Gerencia.
