# Release checklist

Version: 1.0  
Fecha de revisión: 2026-09-05  
Responsable: qa-release delegado por orchestrator

Estados permitidos: `Backlog`, `Ready`, `In progress`, `Review`, `Done`.

| Área | Tarea verificable | Estado | Evidencia o bloqueo |
|---|---|---|---|
| Tests | Ejecutar `npm run typecheck` | Done | Typecheck raíz y paquetes correcto en la validación final. |
| Tests | Ejecutar `npm test` con API, dominio y E2E | Done | 18 tests API, 7 dominio y 4 E2E correctos. |
| Tests | Ejecutar `npm run build` | Done | Build raíz y frontend correctos en la validación final. |
| E2E | Cubrir carga, inicio, dos opciones, pista y resolución de una partida | Done | Prueba Playwright existente; requiere Chromium instalado para reproducirla. |
| E2E | Verificar flujo completo contra la URL pública | Done | Playwright público verificó móvil de 390 px y escritorio, flujo standard, opciones, pistas, resolución y timeout. |
| Migraciones | Aplicar `0001_initial.sql`, `0002_game_mode.sql` y `0003_game_choices.sql` en orden | Done | D1 remota sin migraciones pendientes; migraciones aplicadas en orden. |
| Migraciones | Confirmar binding D1 de producción y ausencia de migraciones pendientes | Done | Worker en producción y `wrangler d1 migrations list --remote`: `No migrations to apply!`. |
| Worker | Confirmar build, rutas API, respuestas `{ error }` y fallos controlados 503 | Done | Contrato, errores controlados y endpoints verificados local y públicamente. |
| Worker | Desplegar Worker y registrar su URL real | Done | `https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev`. |
| Pages | Construir y desplegar frontend | Done | `https://api-pokemon.pages.dev` responde HTTP 200 con el bundle final. |
| Pages | Confirmar que Pages apunta al Worker de producción | Done | Bundle público contiene la URL del Worker de producción. |
| CORS | Validar origen autorizado y rechazar origen no autorizado | Done | Tests locales registrados como correctos. |
| CORS | Configurar `WEB_ORIGIN` con el dominio real de Pages | Done | Preflight autorizado para `https://api-pokemon.pages.dev`; origen externo rechazado. |
| Variables | Revisar `.env.example` sin valores secretos | Done | Plantilla versionada con valores vacíos para claves opcionales. |
| Variables | Configurar variables y secrets en Cloudflare fuera de Git | Ready | Requiere entorno de producción y autorización operativa. |
| Seguridad | Confirmar que nombre/slug/ID del Pokemon no aparece en pistas ni ronda activa | Done | Regla documentada y cubierta por validación local registrada en `AI_USAGE.md`. |
| Seguridad | Confirmar que la puntuación y respuesta correcta se calculan en Worker | Done | Documentado en `README.md` y `MEMORIA_PROYECTO.md`; tests locales correctos. |
| Smoke público | Ejecutar health, OpenAPI, Swagger, partida standard, pistas, timeout, streak y ranking | Done | Smoke público completo; standard terminó 10/10 y ranking, streak, timeout, pistas y contrato pasaron. |
| Entrega | Revisar README, `DECISIONS.md`, `AI_USAGE.md` y este checklist | Done | Documentación y evidencia final revisadas. |
| Entrega | Revisar `git diff --check` y estado limpio antes del commit | Ready | No ejecutar commit ni push como parte de esta tarea. |
| Entrega | Commit de release y entrega al usuario | Backlog | BLOQUEO: requiere decisión posterior del orchestrator/usuario; no hacer push. |

## Bloqueos de release

- **Pendiente operativo:** no se ha creado el commit de release ni se ha dejado el árbol limpio; esta delegación no autoriza commit ni Git push.

## Criterio de salida

El producto queda listo para release desde QA. El cierre administrativo requiere crear el commit de release y verificar el estado limpio del árbol.