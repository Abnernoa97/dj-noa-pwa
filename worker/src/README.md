# DJ NOA · Worker de producción
- `entry.ts`: **única entrada** HTTP para API y comprobaciones de origen, límites de solicitud y enrutamiento.
- `index.ts`: Durable Object ReminderScheduler, recordatorios/push, rate-check y assets.
- `sports/`: rutas MLB, NBA, contexto, actualizaciones live y análisis deportivo.
- `noah/`: chat/voz y visión actuales, con validación unificada de acciones y entrada independiente por ruta.
- `dj-noa-cloud/`: proyecto aislado, no forma parte del Worker de producción.

Se prohíben copias de módulos en la raíz y endpoints paralelos. Mover código no significa fusionar lógica: primero las pruebas, luego equivalencia y QA.
