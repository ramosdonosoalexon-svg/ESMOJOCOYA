# Distrigas Líquidos v0.10.0 — Recepciones: remanente automático, observación opcional

Parche incremental para instalar **encima de v0.9.9**. Cambia solo el componente de Recepciones, la validación de la recepción y un nuevo módulo de cálculo. No modifica Firestore ni los datos iniciales.

## Cambios

- El operador **no escribe el remanente**. El sistema calcula el saldo contable previo de ese producto y ese tanque partiendo del saldo contable inicial, sumando recepciones anteriores, y descontando los despachos netos anteriores asociados al tanque.
- La hora inicial de la descarga es necesaria para ordenar correctamente los registros del mismo día.
- El producto anterior se detecta del historial de recepciones. La identificación de producto no certifica una mezcla física homogénea.
- La explicación/autorización es **opcional**. Si se deja en blanco, se guarda una nota automática que dice que no hay observación ni autorización documentada. Si se escribe, debe tener al menos ocho caracteres, según las reglas ya publicadas.
- Si faltan datos o hay mangueras de alimentación ambigua entre múltiples tanques, se bloquea el cálculo en vez de inventar un remanente.

## Instalación desde PowerShell (Windows)

```powershell
cd "$env:USERPROFILE\distrigasliquidos"

$backup = "$env:USERPROFILE\distrigasliquidos-respaldo-v099-recepciones"
New-Item -ItemType Directory -Path "$backup\src" -Force | Out-Null
Copy-Item .\src\ReceptionBook.jsx "$backup\src\ReceptionBook.jsx" -Force
Copy-Item .\src\receptionData.js "$backup\src\receptionData.js" -Force

Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-recepciones-auto-v0.10.0.zip" -DestinationPath "$env:USERPROFILE\distrigasliquidos" -Force

node --test .\tests\reception-auto-balance-v0100.test.mjs
npm.cmd run build
```

Si **ambos comandos** terminan correctamente:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

No hace falta publicar reglas. No borres ni modifiques los registros ya guardados.

## Prueba

1. Abre Recepciones, 10/11/2026 y el tanque de gasolina compartido.
2. Selecciona Gasolina Especial Plus e introduce la **hora de inicio** de la descarga.
3. El sistema muestra el remanente contable automáticamente (de GE, si era el producto previo), sin casilla editable.
4. Deja vacía la observación, completa la factura, proveedor, alturas, horas y litros documentados y guarda.
5. Comprueba el detalle en Recepciones y la conciliación en Movimientos. Si aparece advertencia de vinculación o saldo negativo, revisa los arqueos/historial: no fuerces un número.

**Alcance:** cálculo contable basado en registros con hora válida; no verifica composición química ni sustituye controles de calidad o autorizaciones exigidas por normativa. En operaciones simultáneas, la confirmación debe auditarse contra los registros del mismo turno.
