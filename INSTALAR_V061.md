# Distrigas Líquidos – actualización v0.6.1 (Recepciones)

## Objetivo
Corregir la navegación del botón «Nueva recepción» para abrir la planilla dentro de la pestaña Recepciones, encima del libro mensual. El formulario sigue la secuencia de la matriz: identificación de cisterna/tanque/producto, medición física antes y después, otros ingresos, meters opcionales y diferencia de transporte calculada. Se añade protección de errores de renderizado: si un dato inesperado impide abrir el formulario, se mostrará el error dentro del módulo en vez de dejar en blanco toda la aplicación.

## Archivos incluidos
- `src/ReceptionBook.jsx`
- `src/reception.css`

No modifica `.env`, `firestore.rules`, módulos de Inventarios, colecciones ni datos guardados. **Requiere tener instalada la v0.6** (ya incorporó `receptionData.js`, `receptionMath.js` y el enlace desde `App.jsx`).

## Instalar en PowerShell (Windows)
Descarga `distrigasliquidos-recepciones-v0.6.1.zip` en Descargas.

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-recepciones-v0.6.1.zip"
if (!(Test-Path $zip)) { throw "No se encuentra el ZIP descargado: $zip" }
if (!(Test-Path "$proyecto\src\ReceptionBook.jsx")) { throw "No encuentro Recepciones v0.6; no apliques este parche sobre una versión anterior" }
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v06-antes-061"
New-Item -ItemType Directory -Path "$backup\src" -Force | Out-Null
Copy-Item "$proyecto\src\ReceptionBook.jsx", "$proyecto\src\reception.css" -Destination "$backup\src" -Force
Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force
cd $proyecto
npm.cmd run test:reception
npm.cmd run build
```

**Solo si `npm.cmd run build` finaliza bien**, desplegar Hosting. No se necesita cambiar reglas para este parche:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Abrir https://distrigasliquidos.web.app y usar `Ctrl + F5` para evitar la versión en caché.

## Verificación funcional
1. Entra como administrador a la estación y abre **Recepciones**.
2. Pulsa **Nueva recepción**. Debe mostrarse un formulario dentro de la misma pantalla, antes del listado, no navegar a una página diferente.
3. Selecciona tanque, producto recibido, documento y cisterna. Introduce medición antes y después; los litros se calculan con la tabla del tanque.
4. Si hubo ventas durante la descarga, activa el bloque de meters (opcional) para anotar las lecturas antes/después.
5. Revisa recibido calculado y diferencia de transporte; completa observación y guarda.
6. Al guardar vuelve al libro mensual. Si faltan meters, la diferencia se identifica como provisional.
7. Si aparece una caja de error en lugar del formulario, copia el mensaje exacto y compártelo para resolver la causa concreta. El cambio incluye una protección, no una afirmación de que se haya reproducido el error en tu entorno.

## GitHub después de verificar

```powershell
git add src/ReceptionBook.jsx src/reception.css
git commit -m "Distrigas Liquidos v0.6.1 - Formulario de recepciones integrado"
git push
```
