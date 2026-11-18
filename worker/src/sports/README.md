# Worker / Deportes · único capítulo servidor
- `mlb.ts`: datos, calendario y resultados MLB.
- `nba.ts`: datos, calendario y resultados NBA.
- `sportsContext.ts`: contexto de juego, rachas, jugadores, alineaciones.
- `sportsLive.ts`: marcadores, probabilidades e información en directo.
- `sportsAnalysis.ts`: análisis con IA; política de no inventar resultados.

Consumidor externo único: `../entry.ts`. No usar estas funciones desde la PWA; los archivos de interfaz viven en `src/features/sports/`.
**Pendiente P01/P09:** inventario de normalizadores, probabilidades y parsing duplicados entre estos archivos; no fusionar sin comprobar equivalencia semántica.
