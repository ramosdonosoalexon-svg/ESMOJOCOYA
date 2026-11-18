# DISTRIGAS LÍQUIDOS v0.11.8 — SUSTANCIAS CONTROLADAS · PRIMERA PARTE

## Qué incluye

- Nueva pantalla «Sustancias Controladas» en el menú lateral y en cada establecimiento.
- Ficha identificatoria por estación, guardada una sola vez en Firestore: registro DGSC, razón social, representante legal, ciudad/localidad, dirección, responsable y teléfono.
- Exportación **Excel XLSX** basada en el archivo que envió la estación, con **siete hojas**: RESUMEN; adquisiciones GE, DO y GE+; ventas GE, DO y GE+.
- Mes actual **preliminar** o un mes anterior, con saldos y datos tomados directamente de Inventarios, Recepciones, Meters y Movimientos.
- Las fechas, nombres y cifras del archivo de octubre que se utilizó como referencia fueron limpiados del recurso público; el modelo se completa con los datos reales de la estación elegida.
- Los meses con más compras o días de venta que filas originales amplían las tablas sin cortar registros.
- Sin dependencias NPM nuevas. No se borra/modifica ningún movimiento ya guardado ni se alteran precios o saldos.

## Importante: alcances de los registros existentes

- Los meters contienen volúmenes y, en ocasiones, referencias, pero todavía **no garantizan número de factura y comprador por cada operación**. En «Detalle de ventas» se registra la cantidad por **día**, con el casillero de número fiscal en blanco y «Varios» como comprador genérico; se advierte la limitación. No inventar números de factura.
- Las adquisiciones aprovechan fecha, litros y proveedor; número de hoja de ruta y autorización se completan solo cuando constan en los registros existentes.
- En un tanque compartido GE/GE+ el saldo por producto es **contable**. El saldo físico solo está verificado para la familia conjunta; no inventar reparto físico.
- Los otros ingresos y demasías se presentan en el apartado de diferencias, y las pérdidas en «Pérdidas»; revisar antes de firmar si esos conceptos coinciden con la documentación que exige la DGSC.
- La salida se destina a **revisión y declaración de la estación**; no se firma ni presenta automáticamente. Es un reporte preliminar cuando faltan cierres.
- La **segunda parte** de Sustancias Controladas se desarrollará aparte.

## Instalación en PowerShell (Windows)

Descargar `distrigasliquidos-sustancias-primera-parte-v0.11.8.zip` y guardarlo en Descargas.

```powershell
cd "$env:USERPROFILE\distrigasliquidos"

# Copia de seguridad de los archivos que sí deben cambiar
Copy-Item .\src\App.jsx .\src\App.jsx.respaldo-antes-sustancias-v0118 -Force
Copy-Item .\firestore.rules .\firestore.rules.respaldo-antes-sustancias-v0118 -Force

# Importante: el ZIP NO sobrescribe App.jsx ni firestore.rules
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-sustancias-primera-parte-v0.11.8.zip" -DestinationPath (Get-Location).Path -Force

# Insertar solo accesos y permisos nuevos, con respaldos adicionales
node scripts/install-sustancias-v0118.cjs
node scripts/install-sustancias-rules-v0118.cjs

# Validar los módulos (sin necesitar acceso real a Firestore)
node --test tests/sustancias-v0118.test.mjs tests/anh-report-v0117.test.mjs tests/anh-export-v0117.test.mjs

# Compilar todo el React/Vite local
npm.cmd run build
```

**Si un instalador devuelve error o la compilación falla, NO PUBLICAR.** Las modificaciones de seguridad deben ser examinadas:

```powershell
git --no-pager diff -- firestore.rules
```

Comprobar que hay un bloque nuevo `match /reportSettings/{reportId}` dentro de `match /stations/{sid}` y que se conservaron las demás reglas. Si hay otras diferencias acumuladas, cotejar contra el respaldo con:

```powershell
git --no-pager diff --no-index .\firestore.rules.respaldo-antes-sustancias-v0118 .\firestore.rules
```

Git retorna código 1 cuando existen diferencias; es normal.

## Publicación, solo con `npm.cmd run build` exitoso

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Entrar a https://distrigasliquidos.web.app, actualizar con Ctrl+Shift+R, ir a **REPORTES SUSTANCIAS CONTROLADAS** o pestaña de la estación «Sustancias Controladas».

## Primera utilización

1. Seleccionar estación (Gerencia) o abrir la propia estación (Administrador).
2. Registrar una sola vez Nº de registro de Sustancias Controladas, razón social, representante legal, ciudad, dirección y responsable. Guardar.
3. Elegir **noviembre de 2026**, mes en curso, o cualquier mes pasado con datos.
4. Comprobar los saldos, adquisiciones y ventas mostrados y las alertas del cuadre.
5. Pulsar **Descargar Excel · Primera parte**. El libro contendrá las siete hojas del modelo; imprimir directamente desde Excel cuando haya sido revisado.
6. Verificar identificación de facturas, proveedores y saldos individuales antes de presentar; las observaciones del sistema no sustituyen la validación documental.

## Pruebas realizadas en el entorno de preparación

- 13 pruebas automáticas seleccionadas (Sustancias + ANH) superadas.
- Ejemplo de archivo XLSX generado y reabierto con lector de planillas; siete hojas detectadas, sin errores estructurales en ZIP/XML ni errores de fórmulas inspeccionados.
- No se pudo ejecutar la compilación completa de Vite aquí porque la copia reconstruida no incluye `node_modules`; deberá ejecutarse en Windows antes del despliegue.
- No se accedió ni publicó contenido en tu proyecto Firebase desde esta sesión.
