# Distrigas Líquidos v0.11.2 — Tanque GE/GE+ con bandas horizontales dinámicas

Parche **incremental sobre v0.11.1**. Solamente cambia el dibujo del tanque de gasolina en Inventarios y agrega un cálculo gráfico puro. No cambia Firestore, saldos, meters, recepciones, reglas ni Movimientos.

## Qué cambia

- El volumen físico de la última lectura determina el **nivel total** del tanque (p. ej. 62 % de su capacidad). No se cambia el dato guardado.
- Dentro del líquido, la proporción **estimada contablemente en la fecha del cierre** determina las alturas de las dos bandas: **GE rojo abajo** y **GE+ café arriba**. Con una nueva recepción o nuevos despachos, las proporciones se actualizan cuando Firestore actualiza los registros del cierre consultado.
- Si la composición no puede estimarse a partir del historial, el líquido aparece neutral (gris azulado), nunca como reparto inventado.
- La barra horizontal inferior de porcentajes se **mantiene sin cambios**, GE sigue negro en las cifras y GE+ café. Rojo de la imagen no se aplica a la columna de mermas.
- Es una representación **esquemática**, no la estratificación real del combustible ni una medición química.

## Instalar desde PowerShell en Windows

1. Descargar `distrigasliquidos-tanque-dinamico-v0.11.2.zip` a **Descargas**.
2. En PowerShell ejecutar:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-tanque-dinamico-v0.11.2.zip"
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v0111"

cd $proyecto
if (!(Test-Path $zip)) { throw "No se encontró el ZIP en Descargas: $zip" }
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item .\src\Operations.jsx "$backup\Operations.jsx" -Force

Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force
node --test .\tests\tank-vertical-v0112.test.mjs
npm.cmd run build
```

Si **ambos** comandos terminan sin errores, publicar solo la página:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Recargar `https://distrigasliquidos.web.app` con **Ctrl + Shift + R**.

## Comprobar

- Seleccionar Inventarios y revisar el tanque de gasolina con la última lectura física.
- GE solo: líquido rojo; GE+ solo: líquido café; ambos: bandas **horizontales** roja abajo / café arriba.
- Para los cierres con 12.000 L de Plus del 9/11 y 10.000 L adicionales del 10/11, debe subir la participación visual del café si los saldos contables estimados así lo indican. No se fijan porcentajes manualmente.
- La barra porcentual inferior y los registros originales permanecen iguales.

**Pruebas realizadas en el entorno de preparación**: 131 pruebas de lógica superadas; sintaxis JSX verificada mediante el compilador TypeScript. No se pudo probar la compilación Vite completa porque el entorno de preparación no incluye `node_modules`; se verifica obligatoriamente con `npm.cmd run build` antes del despliegue.

Si el build falla, **no publicar** y compartir el error. Para revertir, recuperar `Operations.jsx` del respaldo y quitar la nueva importación (el archivo `tankVisualMath.js` puede permanecer sin uso).
