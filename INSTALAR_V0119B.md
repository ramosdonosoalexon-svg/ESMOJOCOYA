# Distrigas Líquidos 0.11.9b — Reparación de invitaciones para Gerencia

## Diagnóstico

La regla de `/invitations/{emailId}` deja que Gerencia (`role: owner`) cree invitaciones de **administrador**, pero sólo deja a un administrador de una estación (`role: admin`) invitar **operadores**. La aplicación ofrece esa opción a Gerencia, así que Firebase la rechaza con `permission-denied`.

## Qué cambia

Una sola condición en `firestore.rules`:

Antes:

```js
(isAdmin(request.resource.data.stationId) && request.resource.data.role == 'operator')
```

Después:

```js
(isManager(request.resource.data.stationId) && request.resource.data.role == 'operator')
```

`isManager()` ya comprueba los permisos de Gerencia y de Administración de la estación. Los operadores **no** pueden crear invitaciones. No se cambia ninguna regla de los libros oficiales, ni las reglas del piloto, ni los datos. El instalador comprueba que los bloques estén presentes una sola vez y guarda un respaldo sin sobrescribirlo.

## En Windows (PowerShell)

Desde `C:\Users\nelso\distrigasliquidos`:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-invitaciones-v0.11.9b.zip" -DestinationPath (Get-Location).Path -Force
node .\scripts\fix-operator-invitations-v0119b.cjs
node --test .\tests\fix-operator-invitations-v0119b.test.cjs
git --no-pager diff --no-index .\firestore.rules.backup-before-invitations-v0119b .\firestore.rules
```

El diff esperado es **una sola línea modificada** en el bloque `match /invitations/{emailId}`. El comando `git diff --no-index` devuelve código 1 si encuentra cambios, lo cual aquí es normal.

Si la prueba y el diff son correctos:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
```

No hace falta `npm build`, ni `hosting`, ni Functions. Firebase puede rechazar reglas por motivos ajenos al parche; si pasa eso **no publiques** y comparte el error.

## Si sigue denegado

- El cambio cubre las invitaciones **nuevas creadas por Gerencia**. Si el correo ya tiene una invitación previa, el `setDoc` de la app intenta actualizarla, lo que queda bloqueado por seguridad. Revisar en Firebase Console > Firestore > `invitations` > ID igual al correo en minúsculas.
- Si está logueado un administrador de otra estación, las reglas lo rechazan intencionadamente. Comprueba el perfil `users/<uid>` con `role: admin`, `active: true`, `stationId` de esa estación.
- Nunca crear perfiles `users` manualmente para saltar la activación ni cambiar a reglas públicas.
