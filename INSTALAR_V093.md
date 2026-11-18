# Corrección de permisos para meters de mangueras antiguas – v0.9.3

Se modificó **solo** la autorización de creación en `stations/{sid}/meterShifts/{shiftId}` para permitir mangueras previas a v0.7 que carecen de `productCode`, verificando su tanque de alimentación. Las demás reglas se conservaron sin cambios a partir de las reglas v0.8.

**No publica Hosting, no cambia usuarios ni datos.** Antes de utilizar este archivo, confirma que tus reglas locales son las de v0.8 o v0.8.1 y que no hay cambios posteriores que deban mantenerse.

1. Respaldo de reglas en PowerShell:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Copy-Item firestore.rules firestore.rules.respaldo-v092 -Force
```

2. Descomprimir el ZIP en la carpeta del proyecto y comparar el cambio en Visual Studio Code.
3. Publicar solo las reglas: `firebase.cmd deploy --only firestore:rules --project distrigasliquidos`.
4. Probar guardado en una manguera histórica cuyo `productCode` falte. No introducir nuevos duplicados si el registro ya existe; no reiniciar datos.

Si persiste «Missing or insufficient permissions», revisar el perfil de usuario (`users/{UID}`: `active`, `role`, `stationId`), la fecha inicial operativa y si ya existe el documento `meterShifts/{fecha}_{manguera}_{secuencia}`, pues la actualización de ese documento está prohibida salvo anulación administrativa.

Este parche se verificó con comprobaciones estáticas del archivo, **no** contra el emulador Firestore de la estación.
