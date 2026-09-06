# Release checklist

Version: 1.0  
Fecha de revisión: 2026-09-05  
Responsable: qa-release delegado por orchestrator

Estados permitidos: `Backlog`, `Ready`, `In progress`, `Review`, `Done`.

| Área | Tarea verificable | Estado | Evidencia o bloqueo |
|---|---|---|---|
| Tests | Ejecutar `npm run typecheck` | Done | Registrado como correcto en `AI_USAGE.md`; repetir antes de la entrega si cambia el código. |
| Tests | Ejecutar `npm test` con API, dominio y E2E | Done | Registrado como 25 tests correctos en `AI_USAGE.md`; E2E usa API mockeada. |
| Tests | Ejecutar `npm run build` | Done | Registrado como correcto en `AI_USAGE.md`. |
| E2E | Cubrir carga, inicio, dos opciones, pista y resolución de una partida | Done | Prueba Playwright existente; requiere Chromium instalado para reproducirla. |
| E2E | Verificar flujo completo contra la URL pública | Backlog | BLOQUEO: no hay URL pública verificada ni autorización de despliegue. |
| Migraciones | Aplicar `0001_initial.sql`, `0002_game_mode.sql` y `0003_game_choices.sql` en orden | Review | Hay tres archivos versionados; la aplicación en producción debe confirmarse con Wrangler. |
| Migraciones | Confirmar binding D1 de producción y ausencia de migraciones pendientes | Backlog | BLOQUEO: no se permite despliegue ni comprobación de la D1 pública en esta delegación. |
| Worker | Confirmar build, rutas API, respuestas `{ error }` y fallos controlados 503 | Done | Tests y typecheck registrados como correctos; falta comprobación pública. |
| Worker | Desplegar Worker y registrar su URL real | Backlog | BLOQUEO: despliegue no autorizado; no inventar URL. |
| Pages | Construir y desplegar frontend | Backlog | BLOQUEO: no hay despliegue autorizado ni URL pública verificada. |
| Pages | Confirmar que Pages apunta al Worker de producción | Ready | Requiere URL real del Worker y configuración de producción. |
| CORS | Validar origen autorizado y rechazar origen no autorizado | Done | Tests locales registrados como correctos. |
| CORS | Configurar `WEB_ORIGIN` con el dominio real de Pages | Backlog | BLOQUEO: dominio de Pages aún no verificado; `.env.example` conserva localhost. |
| Variables | Revisar `.env.example` sin valores secretos | Done | Plantilla versionada con valores vacíos para claves opcionales. |
| Variables | Configurar variables y secrets en Cloudflare fuera de Git | Ready | Requiere entorno de producción y autorización operativa. |
| Seguridad | Confirmar que nombre/slug/ID del Pokemon no aparece en pistas ni ronda activa | Done | Regla documentada y cubierta por validación local registrada en `AI_USAGE.md`. |
| Seguridad | Confirmar que la puntuación y respuesta correcta se calculan en Worker | Done | Documentado en `README.md` y `MEMORIA_PROYECTO.md`; tests locales correctos. |
| Smoke público | Ejecutar health, OpenAPI, Swagger, partida standard, pistas, timeout, streak y ranking | Backlog | BLOQUEO: no existe resultado público verificable en esta delegación. |
| Entrega | Revisar README, `DECISIONS.md`, `AI_USAGE.md` y este checklist | In progress | Este checklist y la evidencia de delegación se actualizan en esta revisión. |
| Entrega | Revisar `git diff --check` y estado limpio antes del commit | Ready | No ejecutar commit ni push como parte de esta tarea. |
| Entrega | Commit de release y entrega al usuario | Backlog | BLOQUEO: requiere decisión posterior del orchestrator/usuario; no hacer push. |

## Bloqueos de release

- **Bloqueado:** no hay smoke test público verificable.
- **Bloqueado:** no se ha confirmado la D1 de producción con las tres migraciones.
- **Bloqueado:** no se han verificado las URLs de Worker y Pages ni su integración.
- **Bloqueado:** no se ha configurado `WEB_ORIGIN` con un dominio público real.
- **Bloqueado:** esta delegación no autoriza despliegue, commit ni Git push.

## Criterio de salida

El release no puede pasar a `Done` mientras exista cualquiera de los bloqueos anteriores. No se registran URLs, resultados o configuraciones públicas hasta disponer de evidencia verificable.