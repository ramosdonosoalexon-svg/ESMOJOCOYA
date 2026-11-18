# Distrigas Líquidos v0.11.1 — Corrección Inventarios y vista compacta

Este parche se aplica **sobre v0.11.0**. Solo reemplaza `src/Operations.jsx`, `src/MovementBook.jsx` y `src/movement.css`; agrega una prueba en `tests/`. **No modifica** Firestore, reglas, datos iniciales, lecturas, recepciones ni arqueos.

## Cambios

- Corrige la referencia a `t` que no existía al renderizar la fila `Total físico` de Inventarios. En la versión 0.11.0 provocaba pantalla blanca al entrar.
- La tabla conjunta Gasolinas vuelve a mostrar una sola cifra horizontal por saldo. Si GE+ predomina, la cifra es café; si GE predomina, negra. Una pequeña marca segmentada indica existencia de mezcla estimada, sin desplegar cifras adicionales.
- Las recepciones GE+ se muestran en café. Si en un mismo día hay GE y GE+, aparecen ambos números **en la misma línea** con colores distintos. No se duplica el total.
- El botón pequeño del **ojo** abre el detalle completo GE/GE+. El rojo/verde permanece para mermas/demasías.

## Instalación en Windows PowerShell

Descarga `distrigasliquidos-inventarios-vista-v0.11.1.zip` en la carpeta Descargas.

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-inventarios-vista-v0.11.1.zip"
cd $proyecto

$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v0110\src"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item .\src\Operations.jsx, .\src\MovementBook.jsx, .\src\movement.css -Destination $backup -Force

Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force

node --test .\tests\inventory-movement-v0111.test.mjs
npm.cmd run build
```

**Publica solo si ambas comprobaciones terminan sin errores:**

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Actualizar el navegador con `Ctrl + Shift + R`, entrar a Inventarios, después a Movimientos en fechas 08, 09 y 10 de noviembre. Verificar un único saldo físico, las recepciones de 12.000 y 10.000 L en café, la vista compacta y el detalle al pulsar el ojo. Si otra pantalla blanca persiste, abrir `F12` → `Console` y enviar el primer error rojo con su traza. No cambiar nada en Firestore para esta prueba.

## Alcance de la verificación

La prueba de regresión específica y 120 pruebas lógicas existentes pasaron en el entorno de preparación. La sintaxis JSX fue revisada. No se completó la compilación con Vite en este entorno por falta de acceso a su registro de paquetes. No se desplegó en la nube; el comando de publicación lo ejecuta el operador en la máquina con credenciales.
