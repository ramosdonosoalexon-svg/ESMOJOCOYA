# Distrigas Líquidos v0.6.4 — Filtro de productos y tanques en Recepciones

## Cambio
- La barra de productos muestra exclusivamente los productos activados en Configuración y que cuenten con al menos un tanque activo compatible.
- No se muestra GNV en Recepciones de líquidos.
- En la fila de recepción, la lista de tanques muestra únicamente los tanques activos compatibles con el producto seleccionado.
- El producto recibido solo ofrece productos habilitados, pero el selector de producto anterior permite conservar el remanente histórico de un producto desactivado.
- Una gasolina y otra de la misma familia pueden compartir tanque con medición física total; se conserva el detalle contable por producto.
- Los registros antiguos no se borran. El filtro «Todos los líquidos» conserva la posibilidad de consultarlos.

## Instalación PowerShell
```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-filtro-productos-v0.6.4.zip"
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v063"

if (!(Test-Path $zip)) { throw "Falta descargar $zip" }
New-Item -ItemType Directory -Path "$respaldo\src" -Force | Out-Null
Copy-Item "$proyecto\src\App.jsx", "$proyecto\src\ReceptionBook.jsx" -Destination "$respaldo\src" -Force
Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force
cd $proyecto
npm.cmd run test:reception
npm.cmd run build
```

**Si el build falla no publiques.** Si compila:
```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos

git add src/App.jsx src/ReceptionBook.jsx
git commit -m "Filtrar productos y tanques activos en recepciones"
git push
```

Este parche no modifica `.env`, reglas de Firestore ni documentos existentes.
