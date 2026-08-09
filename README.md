# Turapp - App de Pasajeros

Esta es la aplicación web para pasajeros de Turapp, construida con [Next.js](https://nextjs.org).

## Despliegue en EasyPanel (Docker)

El proyecto incluye un `Dockerfile` optimizado para Next.js (modo `standalone`), ideal para desplegar en tu propio VPS utilizando **EasyPanel**.

### Pasos para EasyPanel:

1. **Crear un nuevo Servicio:**
   Entra a tu EasyPanel y crea una nueva aplicación del tipo **App**.
   
2. **Conectar GitHub:**
   En la pestaña "Source", selecciona **GitHub** y escoge este repositorio (`turapp-pasajeros`).
   - Branch: `master`
   - Build Method: **Nixpacks** o **Dockerfile** (Selecciona Dockerfile para usar nuestro entorno optimizado).
   
3. **Variables de Entorno (Environment):**
   Ve a la pestaña "Environment" y pega las siguientes variables (sustituye con tus valores reales de Supabase):
   
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
   ```
   
4. **Deploy:**
   Presiona **Deploy** en la esquina superior derecha. EasyPanel construirá la imagen de Docker automáticamente y encenderá tu servidor web.

## Desarrollo Local

Para correr el proyecto en tu máquina:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver el resultado.
