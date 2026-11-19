# 08 · REGISTRO DE EXCEPCIONES DE DUPLICACIÓN (P01)

**Corte del auditor verificado:** 18 de noviembre de 2026 · commit `3ea1565` · 153/153 pruebas, Cloudflare SUCCESS. **No es un segundo plan maestro:** las tareas activas siguen en `01-TABLERO-MAESTRO.md`.

## Un grupo «exacto» del AST (falso positivo funcional)
- `src/features/excel/SheetWorkspace.tsx:494` frente a `src/features/tasks/ReminderWorkspace.tsx:239`. Son callbacks de formularios en superficies diferentes con estado/campos/destino distintos. La comparación de tokens AST encontró una forma de callback equivalente, **no una misma operación de negocio**. No convertirlos en una función genérica por la cifra. Si algún día se extrae un campo UI, conservar los props y eventos de cada formulario.

## Ocho pares «similares» pendientes y decisión de propietario
| Origen A | Origen B | Evaluación y dueño |
|---|---|---|
| `worker/src/sports/nba.ts:handleNbaRequest` | `worker/src/sports/mlb.ts:handleMlbRequest` | Orquestación parecida, pero proveedores, fallbacks y reglas de liga diferentes. Cada router conserva su contrato; datos ESPN comunes ya viven en `sports/shared/espnCore.ts`. |
| `worker/src/sports/nba.ts:abbr` | `worker/src/sports/mlb.ts:abbr` | NBA genera iniciales; MLB usa tabla oficial de nombres. Se inyecta el resolver en `createTeamView`, sin fusionar las políticas. |
| Callback de tarjeta MLB | Callback de tarjeta NBA | Estructuras de presentación similares pero pantallas/datos distintos; las cuotas y reloj/refresco ya comparten componentes. P09 UI sólo si la QA visual autoriza una tarjeta genérica. |
| Callback de fotos Excel | Callback de fotos Eventos | Diferentes entidades y permisos de acción. Ciclo de vida de URLs Blob centralizado en `photoPreviews.ts`; el JSX permanece de cada feature. |
| `src/shared/normalizeText.ts` | `src/domains/events/eventIntegrity.ts:normalizedEventIdentity` | Normalizar una cadena no equivale a identidad de evento por título/fecha; evitar colisiones entre eventos. |
| `src/shared/normalizeText.ts` | `worker/src/noah/aiNormalization.ts:normalizeCore` | Contextos cliente/Worker y semántica de `$` del chat distintas. Una política única para Chat/Visión ya existe dentro del Worker, manteniendo el signo de dólar sólo para chat. |
| Callback Noah Imagen | Callback Noah Voz | Flujos de interacción y garantías de medio distintos. Snapshot Excel, validaciones básicas y parse de IA centralizados; no mezclar interfaz de voz y visión. |
| `worker/src/sports/sportsLive.ts:marketsFrom` | `worker/src/sports/shared/espnCore.ts:marketView` | Transformaciones de cuotas similares sobre feeds distintos. Consenso matemático ya compartido, pero la forma/precedencia de mercado de Live exige tests de feed antes de fusionar parsers. |

**Significado del informe:** Los números 1/8 son señales del analizador, no 9 funciones demostradas como sobrantes. No falsificar «0» eliminando tests, ignorando archivos o descartando diferencias reales. Abrir P03/P04/P09 para refactor UI cuando exista equivalencia probada.

## CSS no confundir con duplicados de funciones
- 33 archivos de estilos cargados en orden explícito; **182 selectores** reaparecen en diferentes CSS, a menudo por media queries o prioridades de cascada.
- **2,978** declaraciones `!important`; solamente 30 fueron redundantes entre las 36 declaraciones idénticas retiradas. Un `!important` restante no se puede declarar inútil sin conocer especificidad, estados y dispositivo.
- `scripts/audit-css-prunable.mjs` da **0** candidatos de eliminación segura exacta tras la poda. Los otros **11 bloques idénticos** y **600 comparaciones de valor diferente** son tareas de reorganización P10, no una lista de borrado automático.
- Requiere QA en Android y iPhone: orientación Excel, scroll, paneles, teclado, overlays y PWA. Esa validación **no se ha efectuado**.

## Restricciones permanentes
Una sola rama `main`, cero GitHub Actions, publicar por Cloudflare, mantener `dj-noa-cloud/` pausado. La base Dexie y datos de prueba pueden limpiarse **sólo con una migración explícita y reproducible** en P02/P04, no como efecto lateral de P01.
