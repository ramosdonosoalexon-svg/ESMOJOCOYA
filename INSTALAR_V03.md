# Distrigas Líquidos — actualización v0.3 (meters dobles)

## Qué cambia

- En **Configuración → Mangueras**, al crear una manguera puedes elegir **Mecánico + digital (ambos)**, **Solo mecánico** o **Solo digital**.
- En las **mangueras ya registradas** también aparece el control «Meters de esta manguera» para activar los dos sin borrar la manguera, su dispenser ni su relación con tanques.
- La configuración nueva se guarda en Firestore como `meterTypes: ['mecanico', 'digital']` (o un elemento si solo tiene uno). Los documentos antiguos con `meterType` siguen siendo legibles.
- La pestaña **Meters / arqueos** sigue siendo un módulo pendiente: este parche permite configurar ambos medidores, pero **todavía no captura las lecturas numéricas de inicio y cierre de turno**.

## Instalar desde PowerShell (Windows)

1. Descargar `distrigasliquidos-meter-dual-v0.3.zip` en Descargas.
2. Abrir PowerShell y ejecutar:

```powershell
cd "$env:USERPROFILE\distrigasliquidos"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\distrigasliquidos-meter-dual-v0.3.zip" -DestinationPath "$env:USERPROFILE\distrigasliquidos" -Force
```

**No se incluye ni se cambia `.env`**. Tampoco se borran estaciones, mangueras ni otros registros de Firebase.

3. Publicar **primero** las reglas de Firestore para permitir el campo `meterTypes`:

```powershell
firebase.cmd deploy --only firestore:rules --project distrigasliquidos
```

4. Compilar y publicar el sitio **solo si la compilación termina sin errores**:

```powershell
npm.cmd run build
firebase.cmd deploy --only hosting --project distrigasliquidos
```

5. Subir los cambios al repositorio:

```powershell
git add src/App.jsx src/data.js src/styles.css firestore.rules
git commit -m "Permitir meters mecanico y digital por manguera"
git push
```

## Comprobar

En el panel del propietario o administrador entra a una estación, **Configuración → Mangueras**. Debe aparecer la opción **Mecánico + digital (ambos)** en el formulario de creación, y un selector de meters al lado de cada manguera existente. Al cambiar el selector, se guarda automáticamente, y los dos tipos aparecen en el resumen de la manguera.

## Seguridad y límites

- Solo propietario o administrador de la estación puede modificar la configuración de meters; se mantienen protegidas las demás propiedades de cada manguera.
- No se modifican datos de inventarios, recepciones ni lecturas previas.
- Si el despliegue de reglas falla, **no publiques el Hosting todavía**: el formulario nuevo no podrá guardar los dos tipos.
