# Distrigas Líquidos – Actualización v0.5 · Inventarios visuales

## Alcance

Esta es una **actualización de código** sobre la versión v0.4 ya instalada. NO elimina colecciones ni datos en Firebase.

Incluye:
- Parte superior: **todos** los tanques líquidos registrados, agrupados visualmente por colores de producto, con nombre, capacidad y **último saldo físico** guardado.
- Representación vectorial industrial de tanques, con líquido animado de acuerdo con porcentaje de llenado. La animación no representa un sensor en tiempo real.
- Cilindros GNV con ilustración industrial, nombre, banco y capacidad **geométrica en litros de agua**. No se inventa saldo de GNV.
- Registro nocturno inferior por producto, 9 columnas de fechas: **5 anteriores, 1 activa, 3 posteriores**. Cruza meses y años sin perder continuidad.
- La fecha activa avanza automáticamente al día siguiente **cuando todos los tanques de ese producto tienen medición**.
- Cada celda registra altura en mm y muestra litros calculados por su tabla volumétrica. Los administradores pueden corregir saldos ya registrados con motivo; los operadores no pueden modificarlos.
- Consulta por fecha para revisar un período anterior, sin autorizar registrar fechas futuras.
- Consulta eficiente de la **última medición por tanque**, con un índice de Firestore nuevo.

No incluye todavía la conciliación contable, GNV medido ni los módulos Recepciones, Meters y Movimientos.

## Instalar desde PowerShell

1. Descarga `distrigasliquidos-inventarios-v0.5.zip` y déjalo en `Descargas`.
2. Detén el servidor `npm run dev` si está abierto (Ctrl+C).
3. Ejecuta:

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
cd $proyecto

# Crear respaldo local del código anterior (no afecta Firebase ni GitHub)
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v04"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item "$proyecto\src\Operations.jsx" -Destination "$backup\Operations.jsx" -Force
Copy-Item "$proyecto\package.json" -Destination "$backup\package.json" -Force
Copy-Item "$proyecto\firestore.indexes.json" -Destination "$backup\firestore.indexes.json" -Force

Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-inventarios-v0.5.zip" -DestinationPath $proyecto -Force

# Pruebas de lógica de fechas y calibración
npm.cmd run test:inventory
npm.cmd run test:calibration

# Compilar
npm.cmd run build
```

**Si falla la compilación, no publiques Hosting.** Envíanos el mensaje de error.

4. Si la compilación fue correcta, **publica primero el índice** de la nueva consulta por tanque y fecha:

```powershell
firebase.cmd deploy --only firestore:indexes --project distrigasliquidos
```

**Atención:** Firebase puede tardar en terminar de construir el índice. Si la pantalla muestra "Falta crear el índice de inventarios", comprueba en Firebase Console → Firestore → Índices que esté habilitado/activo. No publiques reglas antiguas ni abiertas.

5. Publica la página:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

6. Verifica `https://distrigasliquidos.web.app` → entrar a una estación → Inventarios.

7. Sube el código a GitHub:

```powershell
git add src/Operations.jsx src/inventoryWindow.js src/inventoryVisual.css src/useLatestInventory.js tests/inventory-window.test.js package.json firestore.indexes.json
git commit -m "Distrigas Liquidos v0.5 inventarios visuales y ventana de nueve fechas"
git push
```

## Prueba sugerida

Con una estación de prueba que tenga 2 tanques de GE, tabla volumétrica y saldos iniciales registrados:
1. En Inventarios aparecerán arriba todas las tarjetas, incluidos tanques de otros productos y cilindros GNV.
2. En la subpestaña GE, registra el saldo físico nocturno del tanque 1 en la fecha activa.
3. La fecha no debe avanzar, porque falta el tanque 2.
4. Registra el saldo del tanque 2 y comprueba que la fecha avance en la franja de nueve columnas.
5. Comprueba que ambos gráficos muestren sus últimos saldos y el nivel porcentual.
6. Como administrador, selecciona un saldo histórico, cambia la medida y escribe una justificación. Como operador, ese historial debe permanecer bloqueado.

## Datos y seguridad

- No se modifica `.env`, `.firebaserc`, `firestore.rules`, `src/data.js` ni los documentos existentes en Firestore.
- Los datos se siguen guardando en `stations/{stationId}/inventoryReadings/{fecha}_{tankId}`.
- La consulta eficiente necesita el nuevo índice `inventoryReadings(tankId ASC, date DESC)` que se entrega en `firestore.indexes.json`.
- No cambian roles, usuarios, accesos ni contraseñas.
- El porcentaje del tanque solo es representativo: `saldo físico / capacidad registrada`. No es una sonda ni una lectura en línea.
- GNV muestra capacidad geométrica, no volumen de gas disponible. La medición GNV queda pendiente de especificación.
