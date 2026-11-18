# Distrigas Líquidos v0.9.9 — Error al cambiar GE a GE+

## Qué corrige
En Recepciones, el detalle de cambio de producto invocaba `productOptions(tank)` sin pasar el segundo parámetro. La función usaba `enabledCodes.includes(...)`, lo que producía `Cannot read properties of undefined (reading 'includes')`.

Ahora la lista de *productos recibidos* continúa limitada a los habilitados y la lista de *producto anterior* incluye los de la familia del tanque, incluso si el anterior fue deshabilitado. No modifica datos, cálculos, reglas ni recibos anteriores.

## Instalación en PowerShell

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Copy-Item ".\src\ReceptionBook.jsx" ".\src\ReceptionBook.jsx.respaldo-v098" -Force
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-recepciones-geplus-v0.9.9.zip" -DestinationPath "$env:USERPROFILE\distrigasliquidos" -Force
node --test .\tests\reception-product-change-v099.test.mjs
npm.cmd run build
```

Si todas las comprobaciones pasan:

```powershell
firebase.cmd deploy --only hosting --project distrigasliquidos
```

Abrir la web, recargar con Ctrl+Shift+R y probar una recepción con el tanque compartido y seleccionar Gasolina Especial Plus. El detalle debe abrir sin error.

**No es necesario** publicar Firestore rules ni tocar el inventario, la tabla de calibración o documentos anteriores.
