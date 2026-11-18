# Capítulo Deportes · DJ NOA

- `MlbWorkspace.tsx`: pantalla MLB.
- `NbaWorkspace.tsx`: pantalla NBA.
- `SportsGameDetail.tsx`: detalles, estadísticas y análisis de encuentros.
- `SportsEnhancer.tsx`: capa de enriquecimiento de eventos deportivos.
- `HardRockMarketEnhancer.tsx`: panel de mercado Hard Rock.
- `styles/`: todos los estilos de deportes en el orden de carga original.

La interfaz consume las APIs de la aplicación. No duplicar rutas de Worker ni servicios de resultados.

## Servidor de deportes

Las cinco rutas y cargas deportivas del Worker están en `worker/src/sports/`. El archivo `worker/src/entry.ts` conserva el ruteo de API y autenticación. No duplicar parsers/normalización dentro de la interfaz.

- `sportsPresentation.ts`: una sola definición de ocho helpers visuales/mercado de la tarjeta MLB/NBA (favoritos, reloj, etiquetas, fecha, cuota). `MlbWorkspace` y `NbaWorkspace` conservan sus propios cachés, llamadas y pantallas.
