# DISTRIGAS LÍQUIDOS v0.6 — Recepciones de cisternas

## Contenido de esta actualización
- `src/ReceptionBook.jsx`: pestaña Recepciones; listado mensual, filtros, formulario por tanque y volumen de documento.
- `src/receptionData.js`: guardado en Firestore y anulación con motivo sin borrar datos.
- `src/receptionMath.js`: cálculos de diferencias de transporte y deducción de despachos durante recepción.
- `src/reception.css`: estilos del módulo.
- `src/App.jsx`: conecta la pestaña Recepciones con el módulo real.
- `firestore.rules`: permisos específicos para `stations/{sid}/receptions`.
- `package.json`: versión 0.6 y pruebas.
- `tests/reception.test.js`: prueba de fórmulas basada en matriz y casos de venta simultánea.

No se envía `.env`, ni `firebase.json`, ni archivos de estaciones ni datos reales.

## Instalar con PowerShell (Windows)
Descarga el ZIP a `Descargas` y usa una terminal nueva:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-recepciones-v0.6.zip"
if (!(Test-Path $zip)) { throw "ZIP no encontrado: $zip" }
if (!(Test-Path "$proyecto\src\App.jsx")) { throw "No encuentro la carpeta actual del proyecto: $proyecto" }

cd $proyecto
$destino = "$env:USERPROFILE\distrigasliquidos-respaldo-antes-v06"
New-Item -ItemType Directory -Force $destino | Out-Null
Copy-Item "$proyecto\src\App.jsx", "$proyecto\firestore.rules", "$proyecto\package.json" -Destination $destino -Force

Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force

npm.cmd run test:reception
npm.cmd run test:inventory
npm.cmd run test:calibration
npm.cmd run build
```

Solo si todos los comandos finalizan sin errores:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Prueba la web: https://distrigasliquidos.web.app

Una vez verificado que la pantalla abre y guarda una recepción de prueba:

```powershell
git add src/App.jsx src/ReceptionBook.jsx src/receptionData.js src/receptionMath.js src/reception.css tests/reception.test.js firestore.rules package.json INSTALAR_V06.md
git commit -m "Distrigas Liquidos v0.6 - Recepciones y conciliacion transporte"
git push
```

## Flujo de pruebas
1. Configura un tanque de líquidos con tabla volumétrica y sus datos iniciales.
2. Abre Recepciones → Nueva recepción y elige el tanque.
3. Elige el producto recibido (puede ser otra gasolina o diésel de la misma familia).
4. Ingresa documento, proveedor, volumen de transferencia y mediciones antes/después.
5. Si hubo ventas entre lecturas, activa `Registrar meters`, selecciona mangueras y registra antes/después de cada medidor (mecánico, digital o ambos).
6. Para una manguera compartida asigna exclusivamente los litros despachados desde el tanque seleccionado.
7. Si se registran todas las mangueras y se confirma la cobertura, la diferencia se clasifica como calculada con meters completos, pendiente de revisión administrativa. En caso contrario permanece provisional.
8. Guarda. Prueba los filtros del mes y la anulación con una razón documentada.

## Fórmula
**Recibido físico estimado** = volumen final - volumen inicial + despachos de ese tanque durante la recepción - otros ingresos.

**Diferencia transporte** = recibido físico estimado - volumen de la cisterna según documento.

La venta registrada por meter mecánico y digital se cuenta **una vez** según el medidor de cálculo seleccionado.

## Limitaciones explícitas de esta etapa
- No se integra todavía con Facturito/GOTA; las lecturas son manuales.
- La medición física determina volumen total del tanque, **no composición química ni desglose físico** de gasolinas.
- Las cifras contables detalladas por tipo y la distribución de diferencias de operación se completarán en el futuro módulo Movimientos junto a los meters diarios.
- Si una misma manguera vendió dos productos entre lecturas, se necesitan lecturas adicionales al cambio; no se puede atribuir el volumen por producto automáticamente.
- Cambios de producto con carga muerta deben ajustarse al procedimiento técnico y autorizaciones aplicables; el programa no autoriza mezclas.
- El formulario genera cantidades en el navegador; para uso productivo es importante agregar revisión independiente y reglas de validación más estrictas (o backend seguro) antes de considerarlas definitivas.
- `npm install`/`vite build` no pudieron ejecutarse en el entorno generador sin paquetes en caché. Las pruebas de fórmulas y calendarios sí pasaron. No publiques si la compilación o el despliegue de reglas fallan.
