# DISTRIGAS LÍQUIDOS · Versión inicial 0.1

## Qué funciona ya en esta versión

- Acceso con correo y contraseña mediante **Firebase Authentication**.
- Propietario: panel global de estaciones y puestos de venta.
- Creación de una estación **junto con una invitación de administrador**.
- El administrador puede activar su cuenta tras verificar su correo.
- Administrador: acceso a su estación y alta por invitación de operadores.
- Configuración por establecimiento de productos, tanques, dispensers y mangueras; cada manguera puede asociarse a varios tanques del mismo producto.
- Reglas de Firestore separan los datos por estación y rol.
- Pestañas previstas para Inventarios, Recepciones, Meters y Movimientos (todavía SIN registros operativos en esta versión).
- Hosting está preparado, pero no se publica sin configurar primero Firebase y probar los permisos.

**No hemos configurado tu Firebase real ni publicado reglas en la consola.** Esos pasos se hacen desde tu PC con una cuenta autorizada.

## 1. Preparar el proyecto en Windows / VS Code

Instala Node.js 24 o utiliza tu instalación actual de Node compatible con Vite 8.

1. Descarga y descomprime `distrigasliquidos-inicio.zip`.
2. Abre la carpeta `distrigasliquidos-inicio` en Visual Studio Code.
3. En Terminal de PowerShell dentro de esa carpeta ejecuta:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Si PowerShell admite `npm`, también puedes ejecutar `npm install`. El uso de `npm.cmd` evita una posible restricción con `npm.ps1`.

## 2. Configurar Firebase web

En https://console.firebase.google.com/project/distrigasliquidos/overview

- En **Configuración del proyecto → General → Tus aplicaciones**, registra una aplicación **Web** si aún no existe.
- Copia los valores `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` del SDK Web al archivo `.env` respetando las variables `VITE_FIREBASE_...`.
- En **Authentication → Sign-in method**, habilita **Correo electrónico/Contraseña**.
- En Authentication → Settings → Authorized domains, comprueba que `localhost` esté autorizado para las pruebas locales. Agrégalo si hace falta.
- En **Firestore Database**, crea la base de datos en modo **producción**, región adecuada, y deja sus reglas cerradas hasta aplicar nuestro archivo de reglas.

No guardes contraseñas, claves de servicio ni credenciales personales en `.env` ni en GitHub. La configuración Web del SDK es pública por diseño, pero el archivo `.env` se excluye por conveniencia.

## 3. Publicar SOLO las reglas, después de revisarlas

Instala CLI (si ya lo tienes, no es necesario hacerlo):

```powershell
npm.cmd install -g firebase-tools
firebase login
firebase use distrigasliquidos
firebase deploy --only firestore:rules
```

Puedes también desplegar las reglas copiando el contenido completo de `firestore.rules` a **Firestore → Reglas → Publicar**. No copies ni publiques reglas de Distrigas GLP: este proyecto es separado.

**Nota:** el despliegue reemplaza las reglas vigentes del proyecto seleccionado. Confirma primero que el proyecto activo es exactamente `distrigasliquidos`.

## 4. Crear el PRIMER propietario (una única vez)

Para evitar que cualquier visitante pueda hacerse propietario, el primer propietario **NO se crea desde la web**.

1. Abre Firebase → Authentication → Usuarios → **Añadir usuario**.
2. Introduce el correo del propietario y una contraseña que se entregará de forma segura al propietario (no la compartas aquí).
3. Copia el **UID** que aparece en Authentication.
4. Ve a Firestore → **Iniciar colección**: `users`.
5. Crea el documento usando como **ID exactamente el UID** del propietario.
6. Añade los siguientes campos, respetando tipos y minúsculas:

| Campo | Tipo | Valor |
|---|---|---|
| `displayName` | string | `Propietario` (o su nombre) |
| `email` | string | **mismo correo de Authentication, en minúsculas** |
| `role` | string | `owner` |
| `stationId` | null | null (tipo Null, NO string) |
| `active` | boolean | true |

No crees documentos de propietario para otra cuenta ni hagas públicos estos permisos. Todas las demás personas utilizarán invitaciones. El propietario inicial debe poder iniciar sesión aunque no haya verificado su correo; **los invitados sí deben verificarlo**.

## 5. Probar localmente

```powershell
npm.cmd run dev
```

Abre la dirección que muestra Vite (normalmente `http://localhost:5173`).

1. Ingresa como propietario.
2. Crea una estación o puesto de venta, indicando correo del administrador.
3. Comunica a ese administrador la dirección de la aplicación; él pulsa **«Tengo invitación: crear cuenta»**, verifica su correo y después pulsa **«Ya verifiqué mi correo · Activar»**.
4. El administrador entra a su propia estación y habilita productos, tanques, dispensers y mangueras.
5. El administrador invita a operadores indicando nombre y correo. Los operadores se registran y verifican igual que el administrador.
6. Verifica con dos cuentas de distinta estación que una no puede acceder a los datos de la otra.

## 6. Subir el proyecto a GitHub desde tu terminal

Repositorio proporcionado: https://github.com/PamelaM83/distrigasliquidos

Si está verdaderamente vacío y tienes acceso como colaborador, dentro de la carpeta ejecuta:

```powershell
git init
git branch -M main
git remote add origin https://github.com/PamelaM83/distrigasliquidos.git
git add .
git commit -m "Inicio de sistema multiestacion y roles"
git push -u origin main
```

**Si el repositorio ya tiene commits** (por ejemplo un README), NO hagas push forzado. En su lugar, clona primero la versión remota y copia sobre ella los archivos del ZIP, y entonces realiza `git add .`, `git commit` y `git push`.

No subas el archivo `.env` ni la carpeta `node_modules`.

## 7. Publicación web (cuando hayamos probado todo)

```powershell
npm.cmd run build
firebase use distrigasliquidos
firebase deploy --only hosting
```

Hosting tendrá la URL que devuelva Firebase al desplegar. No se da por publicado hasta verificar este resultado.

## 8. Próximas etapas (NO incluidas en 0.1)

- Calibraciones de tanques con carga e interpolación de tablas.
- Datos iniciales físicos y contables, por producto/tanque.
- Inventarios nocturnos por fecha operativa.
- Recepciones y diferencias de transporte.
- Lecturas de meters por manguera y múltiples arqueos por día.
- Conciliación diaria: saldo contable, físico, diferencias de transporte y de operación.
- Gestión administrativa de bajas, revocación de invitaciones y rotación de administradores.
- Control de límites por establecimiento/estación también en reglas o backend, auditoría de cambios, respaldos, pruebas de reglas con emulador.
- Integración opcional de solo lectura con Facturito/GOTA.

## Notas de seguridad antes de producción

- Esta versión es un **inicio funcional para pruebas**, no un sistema listo para operar combustible real.
- Los límites máximos de equipos (10 tanques por producto, 2 mangueras por dispenser) se validan **en la interfaz**, no todavía en reglas de servidor. No usar como garantía de control en producción.
- El registro de un correo invitado se basa en **correo verificado y una transacción/lote indivisible** que consume la invitación.
- La creación y el borrado de perfiles privilegiados deben conservarse bajo reglas restrictivas. Nunca activar un `allow read, write: if true`.
- Un mismo correo/usuario pertenece a un solo establecimiento en esta fase, excepto propietario. Las asignaciones multiestación requerirán diseño posterior.
- La interfaz no envía invitaciones automáticamente: el propietario/administrador debe comunicar al invitado la dirección de la web por otro medio.
- Los datos financieros reales, arqueos, inventarios y reportes requieren pruebas de reglas, índices y cálculos antes de habilitarse.
