# Distrigas Líquidos v0.11.5 — Navegación y fecha operativa accesibles

**Base:** instalar sobre la versión v0.11.4, después de compilarla y publicarla. Este paquete solo reemplaza cuatro archivos de interfaz y agrega una prueba: `src/App.jsx`, `src/MeterBook.jsx`, `src/styles.css`, `src/meter.css`, `tests/sticky-navigation-v0115.test.mjs`. No incluye reglas ni archivos `.env`.

## Qué cambia

- Barra de módulos visible en la parte superior al desplazarse por cualquier apartado, conservando su desplazamiento horizontal.
- Selector de fecha de Meters adherido inmediatamente debajo de esa barra, incluso cuando se revisan los dispensers de GNV al final del libro.
- Botones «Día anterior» y «Día siguiente», con restricción para no retroceder antes de la fecha de inicio registrada.
- Accesos directos a Gasolinas, Diésel y GNV sin tener que recorrer todo el libro.
- Al volver a Meters desde otro módulo, se conserva la fecha elegida durante la sesión de estación.
- No altera ni escribe nada en Firestore; mantiene los libros y cálculos ya existentes.

## Instalación Windows PowerShell

1. Descarga `distrigasliquidos-navegacion-v0.11.5.zip` en **Descargas**.
2. Ejecuta estos comandos desde una terminal PowerShell:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$archivo = "$env:USERPROFILE\Downloads\distrigasliquidos-navegacion-v0.11.5.zip"
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v0114"
cd $proyecto
if (!(Test-Path $archivo)) { throw "No se encontró el ZIP en Descargas: $archivo" }
New-Item -ItemType Directory -Path "$backup\src" -Force | Out-Null
foreach ($f in @('App.jsx','MeterBook.jsx','styles.css','meter.css')) { Copy-Item ".\src\$f" "$backup\src\$f" -Force }
Expand-Archive -LiteralPath $archivo -DestinationPath $proyecto -Force
node --test .\tests\sticky-navigation-v0115.test.mjs
npm.cmd run build
```

Si **alguna prueba o el build fallan, no publiques** y envía el error.

3. Si todo funciona, publica solo Hosting:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

4. Prueba en `https://distrigasliquidos.web.app` con `Ctrl + Shift + R`:
   - En Meters ve hasta el final del apartado GNV: la barra de módulos y la fecha siguen accesibles.
   - Selecciona el 01/11/2026 y verifica que se actualicen las lecturas.
   - Usa las flechas de fecha y los accesos rápidos Gasolinas, Diésel y GNV.
   - Cambia a Movimientos y regresa a Meters: la fecha elegida se conserva.
   - En móvil o ventana reducida comprueba que la barra horizontal siga desplazándose.

## Validación del paquete

Se ejecutaron las 154 pruebas JavaScript y se verificó la sintaxis JSX de los dos componentes editados. No fue posible ejecutar `npm run build` en este entorno sin las dependencias de Vite; esa comprobación debe completarse antes de publicar.
