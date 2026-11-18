# MOJOCOYA SRL — Plataforma de control de combustibles

Sistema independiente de gestión de estaciones de servicio y puestos de venta, basado en React, Vite y Firebase.

Incluye acceso por roles, configuración de estaciones, tanques, dispensadores y mangueras, inventarios, recepciones, meters, movimientos, operadores y reportes.

**Importante:** Este repositorio tiene código propio de MOJOCOYA SRL. No reutilizar la base de datos, usuarios ni despliegue del sistema original. Cada empresa debe tener su proyecto Firebase independiente.

## Configuración inicial

Consulta [INICIO.md](./INICIO.md). Crear `.env` a partir de `.env.example` con los valores de la aplicación web de Firebase **MOJOCOYA SRL**. Los archivos `.env` y `.firebaserc` no se guardan en GitHub.

## Pruebas y despliegue

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

No ejecutar `firebase deploy` hasta identificar de manera inequívoca el ID del proyecto Firebase de MOJOCOYA SRL, habilitar sus servicios y revisar las reglas de Firestore.