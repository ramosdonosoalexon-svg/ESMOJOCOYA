# Distrigas Líquidos v0.8 — Movimiento de productos

## Contenido
- Pestaña **Movimientos** habilitada como libro mensual por producto activo.
- Mes de apertura: **mes actual de Bolivia**. Cada producto dispone de su propio selector de mes.
- Encabezados agrupados y columnas de movimientos que aparecen solo cuando hay datos.
- Líquidos: saldo anterior, ingresos, salidas por meters, transporte, operación, saldo físico y contable final.
- GE/GE+ (o DO/D-ULS) con tanques compartidos: **saldo contable individual** y **conciliación física conjunta**. No se inventa un inventario físico independiente por gasolina.
- GNV: entradas por los tres controles del puente, salidas de dispensers y diferencia técnica provisional.
- Observaciones por día mediante icono (escritura de propietarios y administradores).
- No cambia datos anteriores, no borra estaciones y no toca `.env`.

## Instalar en Windows PowerShell
1. Descargar `distrigasliquidos-movimientos-v0.8.zip` a Descargas.
2. Abrir PowerShell y detener el servidor Vite anterior con Ctrl+C si está abierto.
3. Respaldar archivos y descomprimir:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v072"
New-Item -ItemType Directory -Force -Path "$respaldo\src" | Out-Null
Copy-Item "$proyecto\src\App.jsx" -Destination "$respaldo\src" -Force
Copy-Item "$proyecto\firestore.rules", "$proyecto\package.json" -Destination $respaldo -Force
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-movimientos-v0.8.zip" -DestinationPath $proyecto -Force
cd $proyecto
npm.cmd install
npm.cmd run test:movement
npm.cmd run build
```

4. **Solo si las pruebas y compilación concluyen correctamente**, publicar reglas y Hosting:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

5. Probar https://distrigasliquidos.web.app → estación → Movimientos. Deben mostrarse los productos activos y el mes actual. Cambiar el mes de uno y comprobar que los demás permanecen sin cambios. Revisar observaciones y una fecha con inventario nocturno.

6. Guardar en GitHub:

```powershell
git add src/App.jsx src/MovementBook.jsx src/movementMath.js src/movement.css firestore.rules tests/movement.test.js package.json package-lock.json
git commit -m "Movimientos mensuales v0.8 por producto"
git push
```

Si `package-lock.json` no existe, omitirlo del comando `git add`.

## Advertencias de conciliación
- Las diferencias de transporte de recepciones sin cobertura completa de meters son **provisionales**.
- Un inventario físico nocturno pertenece al tanque y a la familia de combustible, no a cada subtipo comercial cuando comparten tanque.
- GNV muestra diferencia técnica entre volumen corregido y dispensers. No es merma física definitiva sin un inventario apropiado.
- El módulo usa registros anteriores al mes para arrastrar saldos: la eficiencia se optimizará con cierres/snapshots mensuales cuando crezca el historial.
- La columna de importe de meters refleja **valor de despachos**, no dinero efectivamente cobrado.
- Si los despachos registrados en Recepciones durante descarga no se reflejan también en Meters, será necesario conciliar su cobertura antes de concluir mermas.
- Esta versión es para pruebas de conciliación; requiere validar con los datos reales y las fórmulas aprobadas de la matriz antes de utilizarla como contabilidad oficial.
