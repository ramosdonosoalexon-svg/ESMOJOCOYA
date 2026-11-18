# Distrigas Líquidos v0.4 — Instalación segura (Windows / PowerShell)

## Incluye
- Orden de dispensers/mangueras por fecha de registro y agrupación de mangueras por dispenser.
- Contraseñas iniciales y restablecimiento directo con **mínimo de 6 caracteres** en interfaz y código de Cloud Functions. **Nota:** para cambiar contraseñas de otros usuarios, la Cloud Function `manageStaff` debe estar desplegada (plan Blaze). Si no está desplegada, usar el flujo de invitación/recuperación.
- Alta de cilindros GNV ilimitados por banco y mangueras GNV alimentadas por línea sin tanque de líquidos.
- Colores por combustible (Gasolina Especial rojo oscuro; Gasolina Plus rojo claro; Diésel Oil azul oscuro; Diésel ULS azul claro; GNV verde).
- Importación de tabla volumétrica individual por tanque líquido desde Excel (selección de hoja y validación de columnas altura mm / volumen L). En la matriz de Ostria se detectan las hojas TK-1/TK-2 con columnas D/E. Formatos `.xlsx` y lectura tentativa de `.xlsm` (si falla, guardar una copia como `.xlsx`).
- Nuevas pestañas **Datos iniciales** e **Inventarios**. Saldos iniciales físicos y contables separados; inicio de cada meter mecánico y/o digital. Inventario mensual por producto y tanque con cálculo de litros por interpolación y correcciones auditadas.

## Paso 1. Descargar
Descargar `distrigasliquidos-v0.4-config-inventarios.zip` a Descargas de Windows.

## Paso 2. Copiar / respaldar sin tocar .env
Abrir PowerShell:

```powershell
$proyecto = Join-Path $env:USERPROFILE 'distrigasliquidos'
$respaldo = Join-Path $env:USERPROFILE 'distrigasliquidos-respaldo-v03'
New-Item -ItemType Directory -Path $respaldo -Force | Out-Null
Copy-Item "$proyecto\src\App.jsx", "$proyecto\src\data.js", "$proyecto\firestore.rules", "$proyecto\package.json" -Destination $respaldo -Force
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-v0.4-config-inventarios.zip" -DestinationPath $proyecto -Force
Set-Location $proyecto
code .
```

El ZIP **no contiene `.env` ni `firebase.json`**, no borra colecciones de Firestore y no reemplaza credenciales.

## Paso 3. Instalar el lector Excel y probar

```powershell
npm.cmd install
npm.cmd run test:calibration
npm.cmd run build
```

Si sale `build failed`, **no publicar todavía**; compartir el error para corregirlo.

## Paso 4. Publicar reglas y web

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Publicar las reglas primero para que las nuevas colecciones no reciban `permission-denied`. No usar `--only functions` sin decidir expresamente el plan Blaze.

## Paso 5. Guardar la actualización en GitHub

```powershell
git status --short
git check-ignore .env
git add .
git commit -m "v0.4 inventarios, tablas volumetricas, cilindros GNV y orden de mangueras"
git push
```

Comprobar que `.env` no figure en los archivos a subir.

## Paso 6. Prueba sugerida en la web
1. Seleccionar la estación ya creada. Los dispensers aparecerán en su orden de alta; las mangueras estarán agrupadas por dispenser.
2. Configuración: activar GNV, crear banco/cilindros, luego un dispenser y manguera GNV (no requiere tanque de líquidos).
3. Crear tanque líquido si falta; en **Tablas volumétricas por tanque**, seleccionar tanque, subir matriz Excel, elegir `TK-1 OSTRIA` (o la hoja de ese tanque), revisar los puntos e importar.
4. Abrir **Datos iniciales**, fijar fecha común; ingresar mm iniciales y saldo contable de cada tanque, y lecturas mecánicas/digitales iniciales.
5. Abrir **Inventarios** después de guardar la fecha y saldo inicial del tanque, elegir producto/mes, pulsar la casilla de fecha y tanque, introducir altura mm y guardar.
6. Verificar en Firestore subcolecciones `calibrations`, `initialSettings`, `initialTanks`, `initialMeters`, `inventoryReadings`. Ninguna colección antigua se borra.

## Alcances que siguen pendientes
- Recepciones de cisternas, Meters/arqueos y Movimientos (mermas/demasías) todavía no están implementados.
- Inventario GNV por banco con presión/temperatura, correcciones de volumen y medición de suministro queda pendiente; no utilizar medidas volumétricas de líquidos para GNV.
- Las reglas y lecturas requieren pruebas con cuentas de propietario, administrador y operador antes de datos reales; esta versión está destinada a pruebas.
- Una contraseña de 6 caracteres cumple el mínimo de Firebase Auth estándar, pero es menos segura que una frase de contraseña; conviene usar contraseñas mayores en producción.
