# Distrigas Líquidos — v0.11.9c: invitaciones y continuidad de Gerencia

## Diagnóstico

El administrador activo de la estación **no bloquea** invitar a un operador. Antes de esta corrección, el formulario confundía los dos tipos de alta y no explicaba cuándo se intentaba reutilizar un correo o una invitación existente. En la captura de soporte el correo elegido para el operador era el mismo que el usuario utiliza habitualmente para Gerencia; **no reutilices una cuenta de Gerencia como operador**.

La versión actual tampoco permite reemplazar limpiamente al administrador sin Cloud Functions, y "Quitar acceso" intentaba llamar a una función que no está desplegada.

## Cambios del parche

- Por defecto se abre **Invitar por correo → Operador de dispenser**, sin depender de que exista un administrador activo.
- Para el correo del mismo usuario o un miembro/invitación de esa estación se muestra un error claro antes de intentar crear.
- Gerencia consulta previamente la existencia de otra invitación con el mismo correo, incluso en otra estación.
- **Quitar acceso / Reactivar** actualiza `users/<uid>.active` directamente bajo las reglas actuales, sin Cloud Functions.
- Gerencia puede permanecer como responsable administrativo mientras no haya un administrador activo.
- Para nombrar reemplazo: desactivar primero al anterior, seleccionar **Administrador (reemplazo)** y usar **Invitar por correo**. Se actualiza `stations/<id>.adminEmail` y crea la nueva invitación en un lote atómico validado por reglas. No da acceso a empleados despedidos.
- No modifica roles existentes, facturación, permisos de arqueos ni documentos de inventario.

## INSTALAR en Windows PowerShell

Descargar el ZIP en `Descargas`. Abrir PowerShell en la carpeta correcta:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-cuentas-v0.11.9c.zip" -DestinationPath (Get-Location).Path -Force
node .\scripts\fix-staff-invitations-v0119c.cjs
node --test .\tests\staff-invitations-v0119c.test.cjs
node --test .\tests\operator-pilot-v0119.test.mjs
```

El instalador **exige** que se haya aplicado v0.11.9b y que encuentre el código esperado. Si algo no coincide, cancela **antes de escribir**. Crea automáticamente estos tres respaldos:

- `src/App.jsx.before-v0119c`
- `src/data.js.before-v0119c`
- `firestore.rules.before-v0119c`

**Revisar reglas antes de publicar:**

```powershell
git --no-pager diff --no-index .\firestore.rules.before-v0119c .\firestore.rules
```

Debe verse una modificación pequeña en `match /stations/{sid}` para permitir que Gerencia cambie `adminEmail` solamente con una invitación de administrador pendiente, creada en la misma operación. No debe haber cambios en otras reglas.

Si las pruebas pasan y el diff es correcto:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
npm.cmd run build
firebase.cmd deploy --only hosting --project distrigasliquidos
```

**No publicar Hosting si el despliegue de reglas o la compilación falla.** No volver a ejecutar los instaladores 0.11.9 ni 0.11.9a.

## Prueba concreta

1. Entrar como propietario a una estación que tenga un administrador activo.
2. Ir a **Personal → Invitar por correo**, rol **Operador de dispenser**, y usar **el correo independiente del operador**, no el correo de Gerencia ni del administrador.
3. Comprobar que la invitación aparece como pendiente, aunque el administrador continúe activo.
4. El operador abre la app, crea cuenta con ese correo y verifica el email; se activa la invitación. Se mantiene el módulo de arqueos en modo de pruebas.
5. Para una vacante, Gerencia puede desactivar al administrador existente desde Personal, seguir administrando la estación y luego invitar a su reemplazo con un correo nuevo.

**Importante:** `users/<uid>.active=false` bloquea datos de Firestore con las reglas vigentes, pero **no elimina la cuenta de Firebase Authentication ni revoca instantáneamente todas las sesiones**. Para revocación efectiva de Auth se necesita gestión privilegiada (consola o Admin SDK). No almacenar contraseñas en Firestore.

## Límites de verificación

Se comprobó el instalador con los archivos locales de v0.11.9b, el cálculo del piloto y las pruebas estáticas. **No se ejecutaron pruebas reales contra tu Firebase ni una compilación completa de Vite en esta sesión.** Los pasos anteriores son obligatorios antes de publicar.
