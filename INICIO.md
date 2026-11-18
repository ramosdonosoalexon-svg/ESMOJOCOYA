# MOJOCOYA SRL — Guía de puesta en marcha

## 1. Instalar y preparar la copia en Windows

Desde `C:\Users\nelso\ESMOJOCOYA`:

```powershell
npm.cmd install
Copy-Item .env.example .env
notepad .env
```

## 2. Configurar exclusivamente Firebase de MOJOCOYA SRL

En https://console.firebase.google.com/, abre **el proyecto Firebase de MOJOCOYA SRL** (no el proyecto de otra empresa). Ve a Configuración del proyecto → General → Tus aplicaciones y copia la configuración SDK de su aplicación Web en `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Activar Authentication → Correo electrónico/contraseña. Comprobar dominios autorizados, incluidos localhost durante las pruebas. Crear Firestore en modo producción si todavía no existe. La aplicación impide usar un proyecto cuyo identificador contenga el nombre de la empresa original.

## 3. Primer propietario (una vez, en el Firebase de MOJOCOYA)

1. En Firebase Authentication → Usuarios → Añadir usuario, crear el correo y contraseña del propietario.
2. Copiar el UID asignado (no divulgar la contraseña).
3. En Firestore crear la colección `users`, documento cuyo ID sea ese UID.
4. Asignar campos:

| Campo | Tipo | Valor |
| --- | --- | --- |
| `displayName` | string | Nombre del propietario |
| `email` | string | Correo de Authentication, en minúsculas |
| `role` | string | `owner` |
| `stationId` | null | Null, no texto |
| `active` | boolean | true |

Los administradores y operadores ingresan por invitación. No permitir que cualquiera se asigne el rol de propietario.

## 4. Pruebas de la aplicación

```powershell
npm.cmd run build
npm.cmd run dev
```

Abrir la dirección indicada por Vite. Probar ingreso del propietario, creación de estación, alta de administrador, equipos, inventarios y permisos.

## 5. Preparar despliegue Firebase — solo MOJOCOYA

Identificar primero el ID exacto del proyecto desde la consola. No publicar reglas ni funciones hasta comprobar el proyecto seleccionado y revisar los permisos actuales. Firebase Hosting, Firestore y Cloud Functions son componentes distintos.

```powershell
npm.cmd install -g firebase-tools
firebase login
firebase projects:list
```

Cuando se haya verificado el ID real de MOJOCOYA, ejecutar despliegues con `--project ID_REAL_DE_MOJOCOYA`. No usar alias ni IDs de otras empresas. Los datos de producción deben crearse en la base propia de MOJOCOYA.

**Nota:** los documentos antiguos `INSTALAR_V*.md` son históricos; para MOJOCOYA usar solo esta guía actualizada.