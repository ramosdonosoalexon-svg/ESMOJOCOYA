# Distrigas Líquidos — versión 0.11.4

## Qué cambia

**GNV > Movimientos:** ahora se muestra un **control diario compacto** inmediatamente debajo de los cinco indicadores del mes y de sus alertas. Contiene:
- Fecha del arqueo.
- Volumen corregido PRM (m³).
- Volumen de dispensers (m³).
- **Merma o demasía diaria con signo** (m³).
- **Diferencia porcentual diaria**.
- Identificación visible: Merma (rojo), Demasía (verde), Sin diferencia o Pendiente.

Los valores del panel diario emplean la misma fórmula y los mismos datos que la matriz detallada y el acumulado mensual. El panel se adapta al ancho del dispositivo; en pantallas pequeñas esconde solo las dos columnas auxiliares de PRM/dispensers, no la diferencia ni el porcentaje.

No modifica la forma de calcular, guardar o consultar los arqueos, el PRM ni la referencia mensual; tampoco cambia las reglas de Firestore. La matriz completa continúa debajo, con sus detalles y observaciones.

## Instalar sobre la versión 0.11.3 (PowerShell)

Descarga `distrigasliquidos-gnv-control-diario-v0.11.4.zip` a Descargas y ejecuta:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-gnv-control-diario-v0.11.4.zip"
cd $proyecto

# Respaldo local del código que cambiará
$respaldo = "$env:USERPROFILE\distrigasliquidos-respaldo-v0113\src"
New-Item -ItemType Directory -Path $respaldo -Force | Out-Null
Copy-Item .\src\MovementBook.jsx, .\src\movement.css, .\src\gnvRiskMath.js -Destination $respaldo -Force

Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force

# Comprobar antes de publicar
node --test .\tests\gnv-daily-v0114.test.mjs
npm.cmd run build
```

**No publiques si los tests o la compilación fallan.** Si `npm.cmd run build` termina sin errores:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Recarga la web con Ctrl + Shift + R y entra a Movimientos > GNV > noviembre 2026.

## Valores de comprobación, tomados de los registros mostrados

| Fecha | PRM corregido | Dispensers | Diferencia (m³) | Diferencia (%) | Tipo |
|--|--:|--:|--:|--:|--|
| 01/11 | 5.815,00 | 5.646,41 | -168,59 | -2,90 % | Merma |
| 02/11 | 5.917,00 | 5.776,79 | -140,21 | -2,37 % | Merma |
| 03/11 | 5.762,00 | 5.638,40 | -123,60 | -2,15 % | Merma |

**Diferencia = m³ dispensers − m³ corregidos PRM**; porcentaje = diferencia / PRM corregido ×100. Son discrepancias técnicas estimadas, no prueba automática de fuga.

## Pruebas ejecutadas en entorno de preparación

- 151 pruebas automatizadas (incluidas 7 nuevas) pasaron.
- Sintaxis JSX comprobada con el analizador de TypeScript: 0 errores.
- Revisión de balance de llaves CSS correcta.
- **Compilación Vite no ejecutada**: este entorno no dispone de las dependencias `node_modules`; debe completarse con `npm.cmd run build` en la computadora del proyecto.

Solo cambia archivos `src/MovementBook.jsx`, `src/gnvRiskMath.js`, `src/movement.css`, y agrega `tests/gnv-daily-v0114.test.mjs`.
