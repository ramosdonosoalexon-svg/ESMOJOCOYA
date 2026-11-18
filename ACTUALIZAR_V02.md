# Distrigas Líquidos — actualización v0.2: gestión de personal

Este ZIP es una **actualización incremental** sobre la carpeta existente `C:\Users\nelso\distrigasliquidos`. **No contiene `.env` y no toca la autenticación ya creada.**

## Cambios
- En **Personal**, el propietario ve administradores y operadores de cada estación. Puede crear cuentas con contraseña temporal, cambiar contraseñas, desactivar/reactivar accesos y crear un nuevo administrador después de retirar al anterior.
- Cada administrador puede crear y gestionar únicamente operadores de su estación.
- Como alternativa sin Cloud Functions, se conservan las invitaciones de operadores, la recuperación de contraseña por correo y el bloqueo de acceso mediante `users.active = false`.
- Los cambios directos de contraseñas y la desactivación en Firebase Authentication se hacen en una función de servidor `manageStaff`, con verificación de roles y registro de auditoría. **La contraseña no se guarda en Firestore.**
- No se modifican los módulos operativos pendientes (Inventarios, Recepciones, Meters, Movimientos).

## Aplicar desde PowerShell (sin perder el .env ni el historial Git)
1. Descarga `distrigasliquidos-personal-v0.2.zip` a Descargas.
2. En PowerShell:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
git status --short
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-personal-v0.2.zip" -DestinationPath "$env:USERPROFILE\distrigasliquidos" -Force
npm.cmd run build
```

Si tienes modificaciones locales sin confirmar en archivos incluidos en la actualización, guárdalas/respáldalas antes de descomprimir.

3. Publica las reglas e índices nuevos:

```powershell
firebase.cmd deploy --only "firestore:rules,firestore:indexes" --project distrigasliquidos
```

4. Publica el sitio web:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

5. Sube el código a GitHub:

```powershell
git add .
git commit -m "Gestion de administradores y contrasenas v0.2"
git push
```

## Para que el propietario cambie DIRECTAMENTE contraseñas ajenas

Firebase Authentication no permite cambiar la contraseña de otra cuenta directamente desde el navegador. Esta versión incluye la función de servidor `functions/index.js` con Firebase Admin SDK, pero para publicarla el proyecto necesita **plan Blaze (facturación activada)**. Blaze tiene cuotas sin costo, pero puede generar cargos por uso. Antes de activar Blaze, confirma el permiso de la propietaria y habilita alertas presupuestarias.

**Solo cuando la propietaria acepte Blaze:** 

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
npm.cmd --prefix functions install
firebase.cmd deploy --only functions:manageStaff --project distrigasliquidos
```

No ejecutes `firebase deploy` sin `--only` hasta haber decidido si vas a desplegar las Cloud Functions.

## Qué funciona sin Cloud Functions
- El administrador de la estación crea invitaciones de operadores (cada operador se registra y verifica su correo).
- El propietario puede **quitar acceso** a usuarios existentes, dejando `active=false` en Firestore. La cuenta permanece en Authentication, pero las reglas ya no le permiten acceder a los datos.
- Se puede enviar correo de recuperación de contraseña para que el empleado establezca una nueva por sí mismo.
- Se corrigió el alta por invitación de operadores para no leer documentos inexistentes que sus reglas no permiten consultar.

Sin Functions **no funciona** asignar directamente una contraseña inicial a otra cuenta, cambiarle su contraseña ni reactivar una cuenta que fue deshabilitada en Authentication. Si se intenta, la interfaz lo advertirá.

## Pruebas recomendadas
1. Entrar como propietario: crear estación, ir a Personal, comprobar la lista de personal.
2. Con Functions activado: crear administrador con contraseña de prueba y verificar que solo ve su estación.
3. Iniciar sesión como admin, crear operador de prueba y verificar que no ve usuarios de otra estación.
4. Cambiar contraseña al operador, cerrar sesión e ingresar con la nueva.
5. Quitar el administrador: comprobar que ya no puede ver datos y que el propietario puede registrar un nuevo administrador.
6. Verificar el historial en `stations/{stationId}/accessAudit`. No usar contraseñas reales en pruebas iniciales.

La función de servidor usa la región `southamerica-east1` y el runtime Node.js 22. Las contraseñas iniciales requieren mínimo 12 caracteres, letras y números; se deben comunicar por un medio privado y cambiar al comenzar a trabajar.
