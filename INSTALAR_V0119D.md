# DISTRIGAS LIQUIDOS v0.11.9d — Navegación y visibilidad por rol

## Correcciones

- **Arqueos operadores · pruebas** aparece en el **menú lateral izquierdo** para propietario (Gerencia) y administrador, sin duplicarse en las pestañas de estación.
- **Reportes ANH, Sustancias Controladas e Impuestos Nacionales** permanecen en la barra lateral para Gerencia y Administrador, pero se retiran las pestañas repetidas de ANH y Sustancias.
- **Operador** no ve los tres reportes ni su título lateral; aunque conserve una selección previa de reportes, la pantalla principal vuelve al panel operativo. Continúa entrando a **Mi turno** como antes.
- Gerencia abre Arqueos desde el menú izquierdo y elige su establecimiento; el administrador abre los arqueos de su estación.
- No modifica inventarios, recepción, Meters, Movimiento mensual, datos históricos, reglas Firestore, personal ni permisos de base de datos. Esta corrección afecta únicamente la presentación y navegación web.

## Instalación desde PowerShell (Windows)

Guarda `distrigasliquidos-menu-roles-v0.11.9d.zip` en **Descargas**. Debes tener instalada la versión 0.11.9c o 0.11.9 del piloto, con ANH 0.11.7 y Sustancias 0.11.8. Abre PowerShell y ejecuta:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
git status --short
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-menu-roles-v0.11.9d.zip" -DestinationPath (Get-Location).Path -Force
node .\scripts\fix-sidebar-roles-v0119d.cjs
node --test .\tests\navigation-v0119d.test.cjs
npm.cmd run build
```

El instalador exige que existan los fragmentos previstos: si detecta otra estructura, **cancela ANTES de escribir** y pide ajustar el parche a tu archivo. Si tiene éxito crea el respaldo `src/App.jsx.before-v0119d`. La segunda ejecución no cambia nada.

### Revisión y publicación

Antes de publicar revisa la diferencia:

```powershell
git --no-pager diff -- src/App.jsx
```

Solo si terminan bien **las pruebas y `npm.cmd run build`**, publica Hosting:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Si además quieres dejar esta corrección guardada en GitHub:

```powershell
git add src/App.jsx scripts/fix-sidebar-roles-v0119d.cjs tests/navigation-v0119d.test.cjs
git commit -m "fix: menu lateral de arqueos y reportes por rol"
git push origin main
```

No utilices `git add .` para evitar subir archivos de respaldo. No despliegues reglas Firestore con este parche: **no han cambiado**.

## Validación visual

1. **Gerencia:** izquierda muestra Arqueos operadores, ANH, Sustancias e Impuestos. Las pestañas horizontales de estación ya no repiten esos tres accesos. Selecciona Arqueos y luego un establecimiento.
2. **Administrador:** igual, pero Arqueos se abre solo en la estación asignada.
3. **Operador:** no aparecen ANH, Sustancias, Impuestos ni el acceso gerencial de Arqueos; sigue abriéndose su módulo **Mi turno**.
4. Si el navegador conserva la pantalla vieja, pulsa `Ctrl+Shift+R`.

## Alcance de seguridad

Ocultar opciones del menú **no reemplaza** las reglas de seguridad de Firebase. Aquí se filtra la navegación por `profile.role` y se impide mostrar componentes de reportes al operador desde el estado de la interfaz. Las políticas de lectura/escritura de Firestore deben mantenerse restringidas por rol y estación como en versiones anteriores.

> No se ha publicado en Firebase ni en GitHub desde este parche. Debe aplicarse sobre los archivos actuales de tu PC y verificarse antes del deploy.
