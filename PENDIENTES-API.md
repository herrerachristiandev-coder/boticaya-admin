# Dependencias del panel administrativo

Estado basado en el handoff del backend del 26 de noviembre. La API usa el prefijo `/api/admin/v1` bajo la sesión administrativa del mismo origen.

| Capacidad | Contrato que usa Angular | Disponibilidad |
| --- | --- | --- |
| Catálogo compartido | GET `/catalog/products?q&after&limit`, POST `/catalog/products` con el contrato de alta en borrador | El handoff confirma que la lectura usa Supabase. Identifica 500 registros de demostración y ningún producto real verificado. La procedencia se muestra como la devuelve el servidor. |
| Detalle y edición de productos | GET y PATCH `/catalog/products/{id}` (ID TEXT codificado). PATCH requiere `expected_version` entero, permiso de administrador e idempotencia. | La interfaz está implementada. El entorno de Supabase devuelve 501 mientras esté pendiente la extensión 021. |
| Imágenes | GET `/catalog/products/{id}` incluye metadatos de imágenes publicados. También existe GET `/catalog/products/{id}/images`. | Los metadatos dependen de 021. Para mostrar archivos, falta una URL de entrega autorizada y un contrato de almacenamiento. |
| Filtros de productos | El listado acepta búsqueda y cursor. El filtro de estado se aplica a la página visible. | Faltan filtros de catálogo completos por estado, categoría y marca en el servidor. |
| Proveedores | GET `/inventory/paged-suppliers` y POST `/inventory/suppliers` con nombre y documento opcional. GET permite `q` tras 021. GET/PATCH `/inventory/suppliers/{id}` requieren detalle y versión decimal. | Listado básico y alta disponibles según el handoff. Búsqueda, detalle y edición devuelven 501 en Supabase mientras esté pendiente 021. El alta y la edición requieren rol administrador. El filtro por estado necesita soporte del servidor. |
| Trabajadores | GET `/workers?q&status&after&limit` para administrador. Devuelve nombre, correo, roles y estado de cuentas de personal de Identity. | Disponible según el handoff. Permisos granulares y datos laborales no están en el contrato. |
| Indicadores | GET `/dashboard/indicators` y GET `/inventory/paged-movements?limit=10` en paralelo. Se aceptan `as_of` y `expires_through` juntos para indicadores con extensión. | El backend entrega indicadores básicos. Catálogo, proveedores, cuarentena y agregados de vencimiento dependen de 021. Las unidades de productos distintos se consultan por producto. |
| Configuración | GET `/settings` | La política operativa de Inventario está disponible en modo de lectura. Falta un contrato de edición. |
| Pedidos | Se requiere GET `/orders?status&q&after&limit` en el adaptador administrativo, con página de pedidos y permiso explícito de consulta. | Falta contrato administrativo. El acceso entre servicios de Orders queda fuera de Angular. |

El adaptador informa los errores sin sustituirlos por filas locales. Las escrituras conservan sus encabezados de sesión e idempotencia. La venta y la liberación sanitaria siguen sujetas a las políticas del backend.
