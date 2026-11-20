# Propuesta de etapa 2

## Inventario · `/inventario`

La pantalla comienza con el listado de productos, su stock disponible y el estado de inventario. La búsqueda acepta nombre o SKU. Los filtros permiten ver stock bajo, productos agotados y vencimientos próximos. Seleccionar un producto presenta sus lotes, las cantidades disponibles, sus fechas de vencimiento y el historial de entradas y salidas.

| Datos de muestra | Campos visibles |
| --- | --- |
| Producto | SKU, nombre, unidad, stock disponible y umbral de reposición |
| Lote | Código, producto, cantidad disponible y fecha de vencimiento |
| Movimiento | Fecha, tipo, producto, lote, cantidad y motivo |
| Alerta | Tipo, producto o lote y detalle |

Para la muestra, un stock de cero se presenta como agotado. Un stock positivo igual o inferior al umbral se presenta como bajo. Los vencimientos se calculan con una fecha de referencia fija de la demo y un plazo de 30 días. Se distinguen los lotes vencidos de los que vencen dentro de ese plazo.

**Criterios de aceptación**

- Buscar por SKU y combinar filtros actualiza los resultados. Limpiar filtros restaura el listado. Una combinación sin coincidencias muestra un estado vacío.
- El detalle muestra los lotes asociados y permite filtrar el historial por entrada o salida. El stock, los lotes y los movimientos de la muestra son coherentes entre sí.
- Las alertas indican su tipo con texto y pueden consultarse con teclado. En móvil se conservan el nombre, el stock, el estado y el acceso al detalle.

## Trabajadores · `/trabajadores`

La pantalla presenta un directorio con búsqueda por nombre, filtros por rol y estado, y tres vistas para consultar trabajadores, roles y permisos, y actividad. Los roles de Administrador y Operador son ejemplos de la interfaz.

| Datos de muestra | Campos visibles |
| --- | --- |
| Trabajador | Nombre ficticio, correo de ejemplo, rol y estado |
| Rol y permisos | Nombre del rol, módulo y acciones que ilustra |
| Actividad | Fecha y hora, actor ficticio, acción y recurso |

**Criterios de aceptación**

- Buscar y filtrar actualiza el directorio y permite recuperar la vista completa. El detalle muestra el rol y el estado del trabajador.
- La matriz de permisos explica las acciones de cada rol con etiquetas visibles. En móvil se puede consultar por rol.
- La actividad se ordena por fecha descendente y permite filtrar por actor. Las vistas identifican los registros como ficticios y son accesibles por teclado.

## Orden de implementación propuesto

Empezar por Inventario y usar los patrones de filtros, indicadores, estados vacíos y presentación adaptable que también sirvan para Trabajadores. Mantener los datos tipados junto a cada módulo y añadir una fuente inyectable cuando facilite sustituir la muestra por una API. Las vistas de esta etapa son de consulta. Las altas, los ajustes de stock y los cambios de acceso quedan para una etapa con integración aprobada.

Antes de implementar esa integración, verificar los contratos de Inventario e Identity. La futura API administrativa aplicará autorización por operación y registrará los cambios administrativos. Supabase se consumirá desde el backend.
