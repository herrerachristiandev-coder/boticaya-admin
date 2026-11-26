# Botica Ya Administración

Panel Angular 21 para el personal autorizado de Botica Ya. Consulta Catálogo e Inventario mediante el adaptador administrativo del mismo origen.

## Inicio en Windows

Desde la raíz de este panel, con Node.js 22.12+ de la rama 22 o Node.js 24 y pnpm 9.15.4:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd start
```

Abre [el acceso local](http://127.0.0.1:4310/login) con una cuenta de personal autorizada. Usa exactamente `127.0.0.1` para que el origen coincida con el permitido por el backend. El servidor de Angular usa `proxy.supabase.json` para enviar solo `/api/admin/**` al adaptador autorizado en el puerto 3034. La disponibilidad de datos depende de la sesión y del entorno configurado por el equipo de backend.

`pnpm.cmd build` genera `dist/admin/browser`. Para una comprobación corta:

```powershell
pnpm.cmd exec ng test --watch=false --include=src/app/admin.spec.ts --include=src/app/cloud-inventory.spec.ts
```

## Organización

- `src/main.ts`, `app.routes.ts` y `auth-guard.ts` inicializan la aplicación, cargan las vistas bajo demanda y verifican la sesión al navegar.
- `admin-api.ts` centraliza HTTP y los encabezados de las escrituras. Los stores de Catálogo e Inventario manejan los datos de sus formularios y tablas.
- `dashboard.ts`, `products.ts`, `inventory.ts` y `records.ts` contienen las vistas conectadas.
- `src/styles.css` reúne los estilos del panel.
- [Dependencias del backend](PENDIENTES-API.md) registra los contratos pendientes.

El panel conserva las validaciones de sesión del adaptador. Los permisos de cada operación y las decisiones de venta y liberación sanitaria se verifican en el backend.
