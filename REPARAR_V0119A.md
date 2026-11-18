# Distrigas Líquidos v0.11.9a — Reparar reglas del piloto

**Motivo:** el instalador v0.11.9 insertaba el bloque con `String.replace(anchor, block + anchor)`. El texto del bloque tiene expresiones regulares terminadas en `$'`, combinación que JavaScript interpreta como «copiar todo el texto posterior». Eso duplicó secciones de Firestore y produjo errores de compilación en múltiples líneas.

## Recuperación segura

1. **No publiques reglas ni Hosting todavía.** No se publicaron las reglas defectuosas porque Firebase rechazó la compilación.
2. Descarga este ZIP y descomprímelo dentro de `C:\Users\nelso\distrigasliquidos`, dejando que reemplace **únicamente** `scripts/install-operator-pilot-rules-v0119.cjs` y agregue los otros archivos del parche.
3. Desde PowerShell, dentro de la carpeta del proyecto, ejecuta:

```powershell
node .\scripts\repair-operator-pilot-rules-v0119a.cjs
node --test .\tests\operator-pilot-rules-v0119a.test.mjs
```

4. Compara las reglas reparadas con el respaldo previo al error:

```powershell
git --no-pager diff --no-index .\firestore.rules.backup-before-operator-pilot-v0119 .\firestore.rules
```

El diff debe mostrar únicamente las funciones y las tres colecciones `operatorPilotSettings`, `operatorPilotShifts` y `operatorPilotReadings`, insertadas ANTES de `match /products/{productId}`. Ningún bloque de `meterShifts`, `priceHistory`, reportes o Sustancias Controladas debe cambiar. `git diff --no-index` devuelve 1 si encuentra cambios: es normal.

5. Si todo es correcto, **primero** publica solo las reglas:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
```

6. Cuando Firebase informe `Deploy complete!`, y tras confirmar `npm.cmd run build` sin errores, publica Hosting:

```powershell
npm.cmd run build
firebase.cmd deploy --only hosting --project distrigasliquidos
```

**Seguridad:** el reparador conserva las reglas dañadas en `firestore.rules.corrupto-respaldo-v0119a`, reconstruye a partir del respaldo intacto `firestore.rules.backup-before-operator-pilot-v0119` y NO toca Firebase. Si el respaldo previo no está disponible o parece incompleto, el programa cancela sin escribir ningún archivo. **No vuelvas a ejecutar el instalador v0.11.9 antiguo.**
