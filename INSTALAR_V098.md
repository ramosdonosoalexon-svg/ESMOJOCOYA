# Distrigas Líquidos v0.9.8 — Saldo físico de medianoche y mermas/demasías

## Qué corrige

1. La lectura física nocturna de Inventario constituye **el saldo final**; el saldo contable calculado aparece aparte, únicamente para conciliación.
2. **Diferencia total = físico final − contable calculado**; **operación = diferencia total − diferencia de transporte** cuando existe recepción.
3. La **apertura del día siguiente** es el físico final del día anterior. Si falta medición física, la apertura queda calculada provisionalmente y la columna físico permanece vacía.
4. Para tanques compartidos GE/GE+ o DO/D_ULS, la conciliación física se hace por **familia**. Si solo hay un producto con saldo/movimientos, se puede mostrar en su fila; si hay mezcla de dos productos, no se inventa distribución física por producto.
5. Los cálculos son de solo lectura y **no modifican Firestore, meters, inventarios, calibraciones ni precios**.

## Instalación en Windows PowerShell

El ZIP es incremental y se aplica **sobre Distrigas Líquidos v0.9.7**.

```powershell
$proyecto = "$env:USERPROFILE\distrigasliquidos"
$zip = "$env:USERPROFILE\Downloads\distrigasliquidos-movimientos-fisico-v0.9.8.zip"
$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v097"

cd $proyecto
New-Item -ItemType Directory -Path "$backup\src" -Force | Out-Null
Copy-Item .\src\MovementBook.jsx "$backup\src\MovementBook.jsx" -Force
Copy-Item .\src\movementMath.js "$backup\src\movementMath.js" -Force

Expand-Archive -LiteralPath $zip -DestinationPath $proyecto -Force

node --test .\tests\movement-physical-v098.test.mjs
npm.cmd run test:movement
npm.cmd run build
```

Si `build` finaliza satisfactoriamente:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

**No cambiar reglas de Firestore, no borrar documentos y no sobrescribir datos iniciales.** Refrescar página con Ctrl+Shift+R.

## Verificación con datos ya registrados

- Gasolina Especial 01/11: inicial 17.558 L, meters 8.432,32 L, contable 9.125,68 L, físico 9.215 L, demasía +89,32 L.
- Gasolina Especial 02/11: **apertura física 9.215 L**, meters 7.360,12 L, contable 1.854,88 L, físico 1.941 L, demasía +86,12 L.
- El sistema puede diferir del Excel por el uso de una tabla de calibración más precisa; **no** se fuerzan los saldos para igualarlos.
- Cuando GE y GE+ comparten tanque con existencias de ambos, revisar **Control físico conjunto · Gasolinas** para el saldo físico final y diferencias. Los saldos contables por producto quedan separados.

## Alcance de la prueba

Se ejecutaron pruebas automáticas de cálculo (11 casos, incluidas las 7 pruebas históricas) y comprobación sintáctica de JS/JSX. No se verificó el build de Vite ni la consulta Firestore real en el equipo del cliente.
