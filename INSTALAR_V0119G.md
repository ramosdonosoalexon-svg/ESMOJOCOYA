# Distrigas Líquidos v0.11.9g — separar mangueras GNV, gasolina y diésel

## Qué corrige

En la versión **v0.11.9f** al seleccionar el modelo GNV se añadía la manguera GNV, pero continuaban visibles los meters GE que ya estaban en el borrador. Ese es el motivo de la captura con **GE y GNV a la vez**. Los datos no se mezclaban en un mismo meter, pero sí aparecían en la misma lista, confundiendo al operador.

Con este parche:
- **Gasolina**: sólo mangueras GE y GE+.
- **Diésel**: sólo DO y D_ULS.
- **GNV**: sólo GNV.
- Esto se cumple en **Vista 3D**, **Lista** y **tarjetas de lecturas**. Tocar una familia o una manguera también cambia el filtro activo.
- Los meters previamente capturados de otros combustibles **se conservan**, pero sólo se muestran cuando cambias a su familia. Al editar o quitar se mantiene el índice correcto del registro.
- No cambia tu archivo GLB, los importes, la lógica de sincronización ni los documentos oficiales de Firestore.

## Instalación Windows PowerShell

Requiere que ya esté instalada la versión **v0.11.9f**. Descarga `distrigasliquidos-filtro-mangueras-v0.11.9g.zip` en **Descargas**. Ejecuta:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-filtro-mangueras-v0.11.9g.zip" -DestinationPath (Get-Location).Path -Force
node .\scripts\install-family-filter-v0119g.cjs
node --test .\tests\operator-family-v0119g.test.mjs
npm.cmd run build
```

El instalador compara las tres fuentes con v0.11.9f antes de reemplazar nada. **Si no coinciden, se detiene sin sobrescribir.** Crea respaldos `.before-v0119g` de cada archivo modificado. Sólo modifica `src/OperatorPilot.jsx`, `src/DispenserPilot3D.jsx`, `src/dispenserPilotCatalog.js` y agrega `src/operatorFamilyFilter-v0119g.css`.

### Publicación

**Sólo si todas las pruebas y la compilación pasan**:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

En el Android abre otra vez la web/PWA; si sigue viéndose el código anterior, cierra la app por completo y recarga para actualizar la caché.

## Prueba en Android

1. Abre «Mi turno» → «Meters» → Vista 3D.
2. Selecciona **GNV** y su manguera. **Debe mostrarse sólo el meter GNV**.
3. Selecciona **Gasolina**. Deben mostrarse los meters GE y/o GE+ que hayas registrado, sin GNV.
4. Prueba también **Diésel** y cambia a **Lista**: los filtros deben ser idénticos.
5. Si un turno ya contiene GE y GNV, comprueba que puedes cambiar de familia sin borrar ninguna lectura. El arqueo consolidado conserva ambos registros.

### Alcance

Este ZIP prepara la corrección; **no realiza el despliegue en tu equipo, GitHub ni Firebase**. Son filtros de interfaz del **piloto de operadores**, no una modificación de mangueras en estaciones ni de Meters oficiales. Esta validación no reemplaza el control de acceso por roles ni reglas de Firestore.
