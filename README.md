# Botica Ya Administración

Aplicación Angular 21 standalone con TypeScript estricto, Angular Router, CSS y pnpm. Primera entrega de demostración para administradores y trabajadores.

## Ejecutar en Windows

Con Node.js 22.12+ de la rama 22 o Node.js 24 y pnpm 9.15.4:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd start
```

Abre [el acceso local](http://127.0.0.1:4310/login) y selecciona **Entrar a la demostración**. El dashboard admite acceso directo a `/dashboard`. El filtro cambia los pedidos visibles y **Volver al acceso** abre el login. El botón **Menú** se muestra en pantallas pequeñas.

Mantén PowerShell abierto mientras revisas el panel. Espera a que aparezca la dirección local antes de abrir el enlace. Si abriste `index.html` desde el Explorador de archivos, vuelve a entrar por la dirección HTTP del servidor.

`pnpm.cmd build` genera `dist/admin/browser`. `pnpm.cmd test` valida navegación, filtro y menú con cobertura. La compilación de SPA requiere que el hosting sirva `index.html` al abrir rutas de la aplicación directamente.

## Organización

- `src/main.ts` y `src/app/admin.ts` inicializan Angular y declaran las rutas.
- `src/app/layout.ts`, `login.ts` y `dashboard.ts` contienen los componentes.
- `src/app/dashboard-data.ts` define el contrato de lectura y entrega una muestra local.
- `src/styles.css` reúne los tokens derivados de la tienda y el diseño responsive.
- `AGENTS.md` y `SKILL.md` definen el alcance, la revisión y el flujo de trabajo con IA.

## Arquitectura actual y destino

El portal de clientes seguirá en `www.boticaya.com`. Su checkout usa React, Vite, Tailwind, TanStack Query y Zustand. En el entorno local Identity vive en un checkout vecino con NestJS y Pedidos está en una carpeta vecina con Node.js y Zod. Ambos usan PostgreSQL. La documentación de Pedidos describe un contrato con Inventario cuya implementación queda pendiente de verificar.

La opción recomendada es `admin.boticaya.com`. También se puede usar `panel.boticaya.com` o `gestion.boticaya.com`. El diseño se plantea para un origen propio y una futura API del mismo origen en `/api/admin/v1`.

La propuesta para una etapa posterior es un monolito modular NestJS con un solo despliegue de backend y módulos de Identidad y acceso, Catálogo e Inventario, Pedidos, y Reportes y auditoría. Durante la transición, adaptadores del servidor podrán consumir los contratos existentes verificados de Identity, Inventario y Pedidos. Supabase PostgreSQL se integrará desde el servidor con TLS, permisos mínimos y transacciones cuando corresponda. El contrato DashboardSnapshot da a la vista un límite para incorporar una fuente HTTP futura mediante inyección de dependencias.

Antes de conectar operaciones reales, verificar los controles aplicables de [OWASP ASVS 5.0](https://asvs.owasp.org/). La API deberá validar entradas y autorizar cada operación según rol y permiso. Proteger sesiones con MFA, cookies HttpOnly y Secure de alcance exclusivo del host y controles CSRF en mutaciones. Registrar eventos administrativos sin credenciales. Añadir pruebas de autorización, auditoría de dependencias y revisión de datos sensibles antes del despliegue.

## Alcance de la próxima revisión

El menú da acceso a `/inventario`, `/productos`, `/pedidos`, `/trabajadores`, `/reportes` y `/configuracion`. En Productos, abre **Nuevo producto** para crear una ficha de muestra. En Inventario, abre **Registrar entrada** para seleccionar la ficha y registrar la cantidad por lote. Reportes refleja el total de inventario de la sesión. Los cambios se conservan en memoria mientras navegas y se reinician al recargar la página. La fecha de operación de la muestra es el 19/11/2026.
