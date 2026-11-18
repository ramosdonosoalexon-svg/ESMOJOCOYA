# Distrigas Líquidos v0.6.3 — Recepciones como libro horizontal

## Qué cambia

- Se elimina el botón «Nueva recepción» y el formulario extenso.
- Una fila vacía aparece directamente en la planilla del día seleccionado.
- Es posible registrar varias descargas en la misma fecha (botón discreto «Agregar otra fila de descarga»).
- La franja de nueve fechas muestra cinco anteriores, la seleccionada y tres posteriores.
- Las columnas calculan automáticamente litros iniciales/finales por calibración, recibido y diferencia de transporte.
- Los metros mecánicos/digitales y cambios de producto permanecen disponibles en «Detalle» de la misma fila.
- Las recepciones existentes se visualizan como filas guardadas; anular conserva el historial.
- Se corrige el acceso nulo a salesDuringReceptionL de las versiones 0.6.1/0.6.2.

## Requisitos

- Proyecto local `C:\Users\nelso\distrigasliquidos` funcionando con v0.6.2.
- El ZIP está en Descargas.
- Archivo `.env` con la configuración real del proyecto.

## Instalación y respaldo en PowerShell

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-recepciones-libro-v0.6.3.zip"
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v062"

if (!(Test-Path $zip)) { throw "No se encuentra el ZIP: $zip" }
New-Item -ItemType Directory -Path $respaldo -Force | Out-Null
Copy-Item "$proyecto\src\ReceptionBook.jsx" -Destination $respaldo -Force
Copy-Item "$proyecto\src\reception.css" -Destination $respaldo -Force

Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force
Set-Location $proyecto
npm.cmd run test:reception
npm.cmd run build
```

Si el `build` falla, **no publiques** y comparte el error.

## Publicación cuando la compilación funcione

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

No es necesario publicar nuevas reglas ni índices: este parche solo cambia interfaz y reutiliza las recepciones existentes.

## Verificación funcional

1. Abre https://distrigasliquidos.web.app y entra a una estación.
2. Abre Recepciones: ya no aparece «Nueva recepción».
3. Selecciona un tanque con tabla volumétrica cargada.
4. Completa factura, proveedor, hora inicial/final, medidas en mm y litros documentados.
5. Comprueba que los litros iniciales/finales y la diferencia se calculan sin pulsar otro botón.
6. Guarda. Debe aparecer la fila en el listado sin perder las anteriores.
7. Usa «Agregar otra fila de descarga» para una segunda descarga del día.
8. Para ventas durante la descarga, abre «Detalle» de esa fila y habilita meters (opcional).

**Nota contable:** sin meters completos, la diferencia de transporte se marca provisional; no es una merma definitiva. Los inventarios físicos y saldos contables por producto permanecen separados. Los cambios de producto aún requieren justificación y no modifican automáticamente el producto fijo del tanque en Configuración.

## GitHub

```powershell
git add src/ReceptionBook.jsx src/reception.css
git commit -m "Recepciones como libro horizontal v0.6.3"
git push
```

El ZIP no incluye `.env`, y no borra ni migra documentos de Firebase. Para cambiar la fecha de registro usa el selector en la cabecera: una recepción no avanza automáticamente de fecha porque puede haber varias descargas en un día.
