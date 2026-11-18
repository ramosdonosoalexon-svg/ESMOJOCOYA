# DISTRIGAS LÍQUIDOS v0.11.7 — REPORTES ANH / OCTANO VOLÚMENES

## Alcance
- Acceso en barra lateral «REPORTES ANH» y pestaña «Reportes ANH» de cada estación.
- Exportación Excel XLSX sin dependencias nuevas, por mes y producto habilitado.
- Estación líquidos: Octano GE, GE+, DO, D_ULS según productos activos + preconciliación ANH estación.
- Estación GNV: además anexo GNV con ventas por dispensers y desglose de salidas; PRM como dato auxiliar.
- Puesto de venta: formato separado de puesto; no genera GNV.
- Conciliación física de familias (GE/GE+, DO/D_ULS) sin inventar desgloses físicos.
- Hoja de alertas: ausencia de mediciones, registros, campos identificatorios y factura internacional.
- PDF/impresión: botón abre documento imprimible, luego usar «Guardar como PDF».
- No se borra/edita Firestore. No modifica reglas ni precios.

## Importante
Estos reportes son PRECONCILIACIONES. No sustituyen la presentación oficial ante la ANH ni generan QR, códigos oficiales, firmas o certificados. Para precio internacional, el anexo sólo puede completar los campos fiscales que consten en los datos; el registro de meter actual NO garantiza placa, NIT ni número fiscal. Deben obtenerse desde factura/XML antes de presentación. Los días sin cierres físicos no muestran cero como si fueran conciliados. El Excel sí permite adelantar el cuadre durante el mes.

## Requisitos
Proyecto local Windows `C:\Users\nelso\distrigasliquidos`, versión 0.11.6 o posterior con navegación de v0.11.5. Tener los archivos ZIP en Descargas. Se incluye instalador conservador que ajusta SOLO las rutas del menú `App.jsx` y deja respaldo; no reemplaza otros módulos ya probados.

## Instalación PowerShell
```powershell
cd "$env:USERPROFILE\distrigasliquidos"

# Respaldo del menú de la aplicación
Copy-Item .\src\App.jsx .\src\App.jsx.respaldo-antes-anh -Force

# Incorporar componentes SIN sobrescribir App.jsx ni los demás módulos
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-reportes-anh-octano-v0.11.7.zip" -DestinationPath (Get-Location).Path -Force

# Activar la sección de reportes en el menú y en cada estación
node scripts/install-anh-v0117.cjs

# Pruebas de las funciones nuevas
node --test tests/anh-report-v0117.test.mjs tests/anh-export-v0117.test.mjs

# Compilar versión local
npm.cmd run build
```
**Si `node scripts/install-anh-v0117.cjs` muestra error de anclaje, NO publiques; copia la salida para integrar manualmente a la edición vigente.** Si build falla, NO publicar.

## Publicación
Sólo si las pruebas y build terminan correctamente:
```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```
Después Ctrl+Shift+R en https://distrigasliquidos.web.app

## Uso
1. Entrar como Gerencia/Administrador. En barra lateral seleccionar **REPORTES ANH** o en el panel de estación la pestaña **Reportes ANH**.
2. El propietario selecciona estación/puesto. El administrador de estación sólo accede a la suya.
3. Elegir mes (actual o mes anterior). Si faltan días o conciliación, figurará **PRELIMINAR**.
4. **Descargar Excel Octano + ANH**: abre en Excel y revisa las hojas «Octano DO», «EESS GE», «ANH GNV» o «Puesto DO» según el tipo de establecimiento.
5. **PDF líquidos / puesto**, **PDF GNV** o **PDF completo**: se abre una pestaña de impresión; pulsa «Imprimir o guardar PDF» y elige impresora PDF.
6. Comparar con Octano Volúmenes y validar contra los formularios aplicables antes de enviar.

## Comprobaciones
- Estación sólo líquidos: no debe exportar ANH GNV.
- Estación líquidos y GNV: los libros aparecen por separado en un solo XLSX.
- Puesto de venta: libros específicos de puesto de venta, sin GNV.
- GE/GE+ en tanque compartido: la hoja «Conciliación física» sí muestra el saldo físico total; las hojas por producto no imputan saldo físico inexistente.
- Meter anulado: no se incluye en ventas.
- GNV: m³ de ventas vienen de dispensers, PRM NO se suma a ventas.
- Días pendientes: no se rellena físicamente ni con ventas supuestas.
- No cambia los registros reales de Firebase ni los documentos de meses anteriores.

## Pruebas realizadas en entorno de preparación
9 pruebas específicas de exportación y cálculos pasaron; se validó con un lector independiente que el XLSX abre correctamente, y se revisó la sintaxis JS/JSX. No se pudo realizar la compilación Vite completa aquí (dependencias del proyecto no disponibles sin acceso a npm); debe verificarse en la PC antes del despliegue. El juego completo de pruebas reconstruidas de versiones antiguas tiene dependencias de archivos previos (`receptionMath.js`) que no estaban incluidos en los paquetes incrementales; esto no corresponde al parche ANH y no se afirma que haya pasado el build completo.
