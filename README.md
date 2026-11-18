# Distrigas Líquidos · Familia Mancilla

Primera base funcional de gestión multiestación con Firebase, React y Vite.

**Para instalar, asignar el primer propietario y publicar:** abre [INICIO.md](./INICIO.md).

### Arquitectura

- `src/` — interfaz React, inicio de sesión, panel central y configuración de estaciones.
- `firestore.rules` — acceso por roles, aislamiento por estación, invitaciones verificadas.
- `firebase.json` / `.firebaserc` — conexión de despliegue a `distrigasliquidos`.
- `.env.example` — variables necesarias para el SDK Web (completar localmente).

### Estado de módulos

| Módulo | Estado |
|---|---|
| Acceso por roles | Primera implementación |
| Creación de estaciones y puestos | Primera implementación |
| Invitación de administradores | Primera implementación |
| Invitación de operadores | Primera implementación |
| Configuración física | Alta inicial; no edición/borrado |
| Inventarios | Planificado |
| Recepciones | Planificado |
| Meters y arqueos | Planificado |
| Movimientos y conciliación | Planificado |
| Facturito/GOTA | Integración opcional pendiente |

No hay datos reales precargados, ni reglas desplegadas remotamente por este archivo.
