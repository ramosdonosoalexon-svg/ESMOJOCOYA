# Distrigas Líquidos — v0.11.9f: visor 3D de dispensadores y mangueras

## Qué utiliza

Se incluye **exactamente el GLB proporcionado**: `Petro_Surtidores_PRM.glb`, sin regenerar los objetos, sin convertirlo ni exportar modelos separados. El archivo pesa ~781 KB y contiene los tres dispensadores, sus respectivas mangueras y el PRM.

La pantalla de **Mi turno → Meters** muestra por defecto **Vista 3D**, con alternativa **Lista** si el dispositivo no tiene WebGL o el operador prefiere lo más rápido. Se puede girar el modelo con el dedo. Al tocar un dispensador o manguera se ofrecen las mangueras de esa familia que estén *realmente configuradas* en la estación, usando sus IDs de Firestore; si sólo queda una, se añade directamente. Las lecturas iniciales se siguen proponiendo mediante la lógica del piloto v0.11.9e.

**Importante:** las tres figuras son representaciones por producto, no equivalen necesariamente a los dispensadores físicos ni a la cantidad de mangueras de cada estación. Una figura puede corresponder a varias mangueras del mismo tipo, por lo que se obliga a elegir su nombre real. La vista PRM es de consulta visual, no registra presiones ni escribe sobre Meters oficiales.

## Instalar en Windows PowerShell

1. Deben estar ya instaladas las versiones **v0.11.9e** de «Mi turno» y sus archivos; este parche sólo toca su interfaz.
2. Descarga `distrigasliquidos-3d-operadores-v0.11.9f.zip` a **Descargas**.
3. En PowerShell:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-3d-operadores-v0.11.9f.zip" -DestinationPath (Get-Location).Path -Force
node .\scripts\install-dispenser-3d-v0119f.cjs
npm.cmd install three
node --test .\tests\dispenser-3d-v0119f.test.mjs
npm.cmd run build
```

**El instalador no sobrescribe reglas, reportes, datos ni otras funciones.** Comprueba que el archivo `src/OperatorPilot.jsx` sea exactamente el de v0.11.9e; si hubo cambios posteriores, se detiene sin modificarlo. Crea respaldo `src/OperatorPilot.jsx.before-v0119f` y agrega `src/DispenserPilot3D.jsx`, `src/dispenserPilotCatalog.js`, `src/dispenserPilot3D.css` y `public/models/Petro_Surtidores_PRM.glb`.

Sólo cuando compilación y pruebas terminen sin errores, publicar:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Después refrescar el navegador con Ctrl+Shift+R; en móviles cerrar y volver a abrir la PWA si hay caché.

## Prueba breve

- Entrar como **operador** a una estación que tenga mangueras asignadas y con el piloto habilitado. Elegir **+ Mi turno**.
- Pulsar un dispensador/manguera visible; elegir la manguera exacta si hay varias. Verificar que el meter inicial sugerido es el del registro correspondiente.
- Cambiar entre **Vista 3D** y **Lista** y confirmar que no se borran las lecturas capturadas.
- Girar con el dedo. Probar en Android; si no hay soporte gráfico, pulsar **Lista**.
- Si la estación tiene GNV, abrir la pestaña **PRM** para visualizar el puente; no añade lecturas de presión automáticamente.
- Registrar una lectura de prueba, guardar borrador y comprobar la persistencia del piloto. No hacer uso productivo hasta que sean validados el mecanismo de lectura oficial y las reglas de seguridad.

## Alcance y limitaciones

- No se instaló ni desplegó nada en el proyecto del usuario: el ZIP es para su equipo.
- El GLB sí se inspeccionó y los nombres, mallas y jerarquías se validaron; el renderizado de Three.js todavía debe probarse en el navegador real y en el Android del operador.
- Es una vista estática interactiva: no simula flujo de combustible ni los manómetros. Puede ampliarse cuando estén confirmados los vínculos físicos dispensador↔manguera.
- Este paquete no modifica Firebase ni datos económicos. Usa `three` para leer tu GLB, sin necesidad de volver a Blender.
