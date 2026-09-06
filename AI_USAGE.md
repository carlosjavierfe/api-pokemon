# Uso de agentes y GitHub Copilot

## Herramienta

Se utilizó GitHub Copilot dentro de Visual Studio Code como agente de desarrollo y revisión. Copilot no se integra como proveedor de pistas en la aplicación.

## Flujo de trabajo

1. Leer `MEMORIA_PROYECTO.md`.
2. El asistente principal enruta la solicitud al agente `orchestrator`.
3. `orchestrator` divide el trabajo y delega cada parte al agente especialista.
4. Pedir autorización antes de editar, ejecutar, instalar, usar Git o desplegar.
5. El agente especialista implementa su parte y entrega resultado verificable.
6. Ejecutar typecheck, pruebas, build o smoke test.
7. Registrar una evidencia breve de la delegación y crear un commit incremental.

## Política permanente de delegación

Cada delegación se registra en este mismo archivo con 3 a 8 líneas:

```text
### YYYY-MM-DD — Orchestrator -> agente
Tarea: resumen de la tarea.
Resultado: archivos o comportamiento entregado.
Validación: comando o prueba ejecutada.
Estado: aceptado / requiere corrección.
```

No se copian conversaciones completas, prompts largos ni razonamientos internos. Se conserva únicamente evidencia verificable.

## Agentes configurados

- `orchestrator`: coordina alcance, tareas y validación.
- `architecture`: contratos, modelo y decisiones.
- `backend`: Worker, D1, PokéAPI y reglas de servidor.
- `frontend`: React, estados y responsive.
- `qa-release`: pruebas, seguridad y despliegue.

Configuración: `.github/agents/` y `.github/skills/`.

## Registro resumido de delegaciones

### 2026-09-05 — Orchestrator -> backend
Tarea: analizar pool Pokemon, selección sin repetición y límite temporal por ronda.
Resultado: recomendación de cambio y casos de prueba para backend.
Validación: revisión de `MEMORIA_PROYECTO.md` y archivos de API.
Estado: aceptado como guía de implementación.

### 2026-09-05 — Orchestrator -> backend
Tarea: implementar ranking standard de partidas completadas en exactamente 10 rondas.
Resultado: filtro por defecto `mode=standard`, exclusión de streak e incompletas y OpenAPI actualizado.
Validación: tests de API y typecheck del backend.
Estado: aceptado.

### 2026-09-06 — qa-release — reproducción pública standard solicitada
Tarea: reproducir contra Worker y Pages públicos una partida `standard` completa, alternando GET/POST hasta la ronda 10, y comprobar persistencia del ranking y resumen visual.
Resultado: Pages HTTP 200. Worker creó `gameId=f90f70b8-d75c-4a49-a34f-63fa3a3a3b5d` para `qa-public-1788730784928` (HTTP 201). Las respuestas alternadas fueron `GET 1 -> POST 2`, `GET 2 -> POST 3`, `GET 3 -> POST 4`, `GET 4 -> POST 5`, `GET 5 -> POST 6`, `GET 6 -> POST 7`, `GET 7 -> POST 8`, `GET 8 -> POST 9`, `GET 9 -> POST 10`, `GET 10 -> POST 10`; todos los GET/POST devolvieron HTTP 200.
Evidencia: la respuesta POST de ronda 10 devolvió `finished=true`, `nextRound=null`, `score=683`, `points=150`, `timedOut=false`; el GET posterior devolvió `status=finished`, `round=10`, `score=683`. `GET /api/scores?mode=standard&rounds=10` devolvió HTTP 200 y la entrada `{ playerName: "qa-public-1788730784928", score: 683, rounds: 10 }` apareció.
Validación UI: en `https://api-pokemon.pages.dev`, Chromium completó 10 rondas con respuestas reales; al finalizar mostró `Ronda 10 / 10`, `Nueva partida`, `Total partida: 800 pts` y la entrada visible `UI QA Public — 800` en el ranking.
Estado: smoke público aceptado; no se modificó código, no se hizo commit, push ni deploy.

### 2026-09-06 — backend/orchestrator — diagnóstico de ranking autorizado
Tarea: verificar `GET /api/scores?mode=standard&rounds=10`, filtros y configuración D1 sin editar código ni desplegar.
Resultado: Worker público respondió HTTP 200 con 8 filas, todas `rounds: 10`; `mode=streak` respondió HTTP 400. El endpoint no lee el query param `rounds`: el código aplica siempre `scores.rounds = 10` y el frontend solicita `/scores` sin `mode` ni `rounds`.
Validación: `curl` contra `https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev/api/scores?mode=standard&rounds=10`; revisión de `apps/api/src/index.ts`, `migrations/0001_initial.sql`–`0003_game_choices.sql` y `apps/api/wrangler.toml`. La consulta D1 `--remote` no terminó por la sesión interactiva/DNS y no se registra como verificada.
Estado: no hay evidencia de fallo de persistencia, frontend o configuración en este diagnóstico; posible defecto de filtro solo si `rounds` debía ser dinámico.

### 2026-09-05 — Orchestrator -> frontend
Tarea: añadir feedback visual accesible para acierto, error y timeout.
Resultado: check verde, X roja e indicador de tiempo agotado en los estados de resultado.
Validación: `npm --workspace apps/web run typecheck` y `npm --workspace apps/web run build` correctos.
Estado: aceptado.

Las siguientes tareas se registrarán aquí únicamente cuando el orquestador las delegue y exista una validación comprobable.

### 2026-09-05 — Orchestrator -> qa-release
Tarea: revisar flujo completo, ranking standard, opciones, temporizador, migraciones, secretos y llamadas externas.
Resultado: ranking standard y feedback visual revisados; documentación de migraciones actualizada.
Validación: `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`; D1 local/remota sin migraciones pendientes.
Estado: aceptado; pendiente smoke test de la URL pública.

### 2026-09-05 — Orchestrator -> backend/frontend/qa-release
Tarea: ranking standard de 10 rondas y feedback visual check/X/timeout.
Resultado: filtro backend, pruebas de exclusión y feedback accesible sin emojis.
Validación: suite API/dominio, typecheck, build y revisión QA correctos.
Estado: aceptado para commit; pendiente push y smoke test público.

### 2026-09-05 — qa-release — smoke test local
Tarea: verificar API, documentación, flujo standard de 10 rondas, opciones, pistas, timeout y streak.
Resultado: `/api/health`, `/api/openapi.json`, `/api/docs`, creación de partida, opciones múltiples, standard completo y streak respondieron correctamente; no se expuso `pokemon` al crear partida.
Validación: `npm --prefix /Users/carlosjaviermendezgutierrez/Documents/lab/api-pokemon-cjmg/wiki-api-pokemon --workspace apps/api test` (12/12), typecheck y build correctos; el timeout pasó con reloj controlado en la suite.
Estado: API local aceptada; pendiente resolver la discrepancia de puertos del proxy Vite (5174 -> 8787 mientras el Worker iniciado en esta sesión quedó en 8788) y smoke test público.

### 2026-09-05 — qa-release — repetición smoke test local
Tarea: repetir smoke test con puertos liberados y verificar flujo API/frontend, modos, timeout, ranking y migraciones.
Resultado: API HTTP en `http://127.0.0.1:8787` y frontend Vite en `http://127.0.0.1:5173`; health, OpenAPI, Swagger, choices, pistas sin nombre, standard 10/10, ranking standard, streak y timeout real respondieron correctamente.
Validación: `npm run typecheck`, `npm test` (19/19), `npm run build`; D1 local y remota devolvieron `No migrations to apply`; smoke HTTP automatizado con todas las aserciones satisfechas. No se usó navegador.
Estado: smoke local aceptado; pendiente revisión de manejo de errores externos y corregir la propagación de argumentos de puerto en los scripts raíz antes de push.

### 2026-09-05 — Orchestrator -> backend
Tarea: normalizar fallos de PokéAPI y D1 sin filtrar detalles internos.
Resultado: timeout, validación, fallback determinista, respuestas JSON 503 y pruebas de errores.
Validación: `apps/api test` (17/17), typecheck y revisión de errores estáticos correctos.
Estado: aceptado, sin despliegue ni push.

### 2026-09-05 — qa-release — validación de release
Tarea: revisar backend, errores externos, ocultación, ranking, modos, CORS, Swagger, secretos y reproducibilidad.
Resultado: typecheck, 24 tests, build y `git diff --check` correctos; PokéAPI timeout/HTTP/payload inválido y D1 devuelven fallback o 503 controlado sin stack.
Validación: flujo API, pistas, opciones, timeout, standard/streak, ranking, CORS y Swagger cubiertos por tests; `.env.example` sin valores y secretos excluidos por Git.
Estado: no listo para commit de release; faltan tests web E2E y alinear OpenAPI con `mode`/streak; no se corrigió, hizo push ni desplegó.

### 2026-09-05 — Orchestrator -> backend
Tarea: alinear el contrato OpenAPI con modos, cuerpos/respuestas actuales, errores 503 y ranking standard; retirar referencias obsoletas a `finish`.
Resultado: OpenAPI documenta `standard`/`streak`, schemas de respuestas y `{ error }`; memoria y README actualizados.
Validación: tests OpenAPI añadidos; typecheck y tests backend ejecutados.
Estado: aceptado; sin cambios frontend, push ni despliegue.

### 2026-09-05 — qa-release — release smoke autorizado
Tarea: ejecutar typecheck, tests, build, Playwright responsive y smoke público contra Pages y Worker sin corregir, desplegar ni hacer push.
Resultado: `npm run typecheck` correcto; `npm test` correcto (18 API, 7 dominio, 4 Playwright); `npm run build` correcto; `git diff --check` correcto; no se detectaron secretos trackeados. Playwright público cargó Pages en móvil/escritorio sin errores JS; escritorio sin overflow. Worker health, OpenAPI, Swagger, CORS autorizado/no autorizado, preflight, validaciones 400, opciones, timeout real de 30 s y streak pasaron.
Hallazgos: BLOQUEO CRÍTICO — producción no mantiene la ronda monotónica al alternar GET/POST. Tras un POST que devuelve ronda 2, un GET inmediato puede devolver ronda 1; con pistas también se observaron respuestas regresivas. El flujo standard 1..10 y ranking completo no son certificables. BLOQUEO ALTO — Pages móvil (390 px) presenta overflow horizontal: `<input>` de entrenador con `right=402` y viewport `390` (12 px fuera); escritorio pasa.
Evidencia pública: Pages `https://api-pokemon.pages.dev`; Worker `https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev/api`. Timeout público: `timedOut=true`, `finished=true`, `points=0`. No se modificó código, no se desplegó y no se hizo push.
Estado: BLOQUEO CRÍTICO RESUELTO por las entradas posteriores `Orchestrator -> backend`, `backend — despliegue y smoke público D1` y `qa-release — smoke final público autorizado`; se conserva esta evidencia histórica para trazabilidad.

### 2026-09-05 — Orchestrator -> frontend
Tarea: reemplazar `web tests pending` por una prueba real mínima de navegador.
Resultado: Playwright cubre carga, modo standard, inicio, dos opciones, pista y resolución con API propia mockeada.
Validación: `npm --workspace apps/web run typecheck`, `npm --workspace apps/web test` y build frontend.
Estado: aceptado; requiere Chromium instalado con `npx playwright install chromium`.

### 2026-09-05 — qa-release — validación final autorizada
Tarea: ejecutar typecheck, tests, build, diff, E2E y revisión de contrato, secretos y puntuación.
Resultado: rutas reales y OpenAPI alineados; no existe `finish`; `mode` standard/streak documentado; E2E intercepta `/api/**` sin llamar PokéAPI; secreto y score permanecen en backend.
Validación: `npm run typecheck`, `npm test` (25 tests incluyendo 1 E2E), `npm run build`, `npm --workspace apps/web test` (1/1) y `git diff --check`, todo correcto; `.env.example` sin valores secretos y sin secretos versionados.
Estado: listo para commit desde el código; bloqueo de release público: no se verificó D1/URL de producción porque no hay autorización de despliegue.

### 2026-09-05 — Orchestrator -> frontend
Tarea: limpiar artefactos generados antes del commit y excluir salidas de Playwright de Git.
Resultado: eliminado `apps/web/test-results/.last-run.json`; añadidas reglas para `apps/web/test-results/` y `playwright-report/`, sin tocar código funcional.
Validación: `git diff --check` y comprobación de archivos generados trackeables.
Estado: aceptado; sin push ni despliegue.

### 2026-09-05 — Orchestrator -> frontend/qa-release
Tarea: corregir overflow responsive, conservar input y opciones, y cubrir móvil/escritorio.
Resultado: sizing global con `box-sizing`, columnas y botones contenidos, altura mínima eliminada, divisor textual retirado visualmente y E2E ampliado.
Validación: `npm run typecheck`, `npm --workspace apps/web test` (4/4 en desktop/mobile), `npm --workspace apps/web run build` y `git diff --check`, todo correcto.
Estado: aceptado; sin backend, push ni despliegue.

### 2026-09-06 — Orchestrator -> frontend/qa-release
Tarea: convertir `PK` en botón accesible para volver al formulario de nueva partida y cubrirlo con E2E.
Resultado: reset completo de partida, resultado, respuesta, error, temporizador y estados de imagen; prueba de navegación desde una partida activa.
Validación: typecheck, Playwright y build ejecutados; sin push ni despliegue.
Estado: aceptado.

### 2026-09-05 — backend — despliegue Worker autorizado
Tarea: validar backend, migraciones D1, desplegar Worker y comprobar endpoints públicos.
Resultado: Worker desplegado en https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev; D1 remota sin migraciones pendientes.
Validación: typecheck correcto, apps/api 17/17 tests; /api/health, /api/openapi.json y /api/docs respondieron HTTP 200.
Estado: Worker aceptado; WEB_ORIGIN sigue en http://localhost:5173 y debe actualizarse cuando exista la URL real de Pages.

### 2026-09-05 — Orchestrator -> qa-release
Tarea: preparar release readiness con checklist de tests, E2E, migraciones, Worker, Pages, CORS, variables, smoke público y entrega.
Resultado: creado `docs/RELEASE_CHECKLIST.md` con estados y bloqueos explícitos; revisados `MEMORIA_PROYECTO.md`, `DECISIONS.md`, `README.md`, scripts, migraciones, `.env.example` y estado Git.
Validación: repositorio en `main` alineado con `origin/main`; no se desplegó, no se hizo commit y no se usó Git push. No se inventaron URLs ni resultados públicos.
Estado: checklist creado; release bloqueado hasta verificar D1/URLs públicas, `WEB_ORIGIN` de Pages y smoke público.

### 2026-09-05 — Orchestrator -> frontend/qa-release
Tarea: preparar y desplegar `apps/web/dist` en Cloudflare Pages con `VITE_API_URL` apuntando al Worker público.
Resultado: build de producción correcto con `https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev/api`; despliegue solicitado con proyecto `api-pokemon`.
Validación: `VITE_API_URL=... npm --workspace apps/web run build` correcto; Wrangler detuvo el flujo porque el proyecto no existe y solicita crear `api-pokemon` interactivamente.
Estado: bloqueado; pendiente autorización/configuración interactiva de creación del proyecto Pages. No se creó Pages, no se modificó backend ni se hizo push.

### 2026-09-05 — frontend/qa-release — despliegue Pages autorizado
Tarea: construir y publicar `apps/web/dist` en el proyecto Pages `api-pokemon` con la API Worker pública.
Resultado: despliegue completado en `https://api-pokemon.pages.dev` (deployment: `https://e4945f18.api-pokemon.pages.dev`).
Validación: build con `VITE_API_URL=https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev/api`; bundle contiene la URL; Wrangler subió 3 archivos; alias público HTTP 200 y HTML con assets.
Estado: aceptado; no se modificó backend ni se hizo push.

### 2026-09-05 — frontend/qa-release — verificación pública final
Tarea: verificar `https://api-pokemon.pages.dev` en móvil de 390 px y escritorio, y publicar la corrección responsive si faltaba en el bundle.
Resultado: el bundle anterior no contenía `box-sizing`, ocultación de `.choice-divider` ni apilado móvil; se reconstruyó con `VITE_API_URL=https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev/api` y se publicó en Pages (`https://cab5c85b.api-pokemon.pages.dev`, alias público activo). Se ajustó `body min-width` de 320 px a 0 para evitar overflow bajo viewport CSS reducido.
Validación: build y typecheck web correctos. En móvil solicitado 390 px (viewport CSS observado 312), `scrollWidth=300`, `bodyScrollWidth=300`, controles `right=280`, divisor oculto y dos opciones visibles; inicio y resolución alcanzables, resultado `Era exeggutor` con feedback visible `Acierto`. En escritorio (viewport CSS 1152), `scrollWidth=1140`, sin overflow y divisor oculto. Bundle público contiene box-sizing, apilado móvil, divisor oculto y URL del Worker. Captura de pantalla de referencia tomada durante la verificación.
Estado: aceptado; no se modificó backend ni se hizo push.

## Prompts y resultados relevantes

### Scaffolding

Solicitud: crear un monorepo con React/Vite, Worker Cloudflare, paquete compartido y migraciones D1.

Resultado: estructura inicial, configuración TypeScript, Vite, Wrangler y migración SQL.

Validación: `npm run typecheck` y `npm run build` correctos.

### Dominio

Solicitud: implementar pistas deterministas, validación anti-spoiler, puntuación, racha y dificultad con pruebas unitarias.

Resultado: dominio en `packages/shared` y 6 pruebas unitarias.

Validación: pruebas Vitest y typecheck correctos.

### Backend

Solicitud: implementar endpoints de partida, pistas, respuesta y ranking sin exponer el Pokemon correcto.

Resultado: API Hono, adaptador PokéAPI, fallback de memoria y binding D1 preparado.

Validación: pruebas HTTP, typecheck y build correctos.

### Frontend

Solicitud: crear una interfaz responsive tipo Pokédex que consuma únicamente la API propia.

Resultado: inicio de partida, silueta, pistas, respuesta, resultado, puntuación y ranking.

Validación: build y typecheck correctos.

### CORS y Swagger

Solicitud: añadir CORS controlado, contrato OpenAPI y Swagger UI sin dependencia pesada.

Resultado: `WEB_ORIGIN`, preflight, `/api/openapi.json` y `/api/docs`.

Validación: pruebas de CORS, OpenAPI, typecheck y build correctos.

## Criterio humano

Se conservaron cambios pequeños y se descartó integrar un proveedor LLM en el MVP por coste, latencia y dependencia externa. También se dejó fuera autenticación y modo infinito para priorizar una entrega funcional y defendible.

### 2026-09-05 — backend — CORS de producción y smoke público
Tarea: configurar `WEB_ORIGIN=https://api-pokemon.pages.dev` en el despliegue de producción del Worker y verificar la API pública.
Resultado: Worker redeployado en https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev; sin secretos expuestos ni cambios en frontend.
Validación: `/api/health` HTTP 200; preflight desde Pages HTTP 204 con `Access-Control-Allow-Origin` correcto; origen no autorizado sin esa cabecera; `/api/openapi.json` y `/api/docs` HTTP 200.
Estado: aceptado; no se hizo push.

### 2026-09-05 — qa-release — smoke test público autorizado
Tarea: verificar Pages, Worker, CORS, partidas `standard`/`streak`, opciones, pistas, ronda activa, resolución y ranking.
Resultado: Pages HTTP 200 con root; Worker `/api/health`, `/api/openapi.json` y `/api/docs` HTTP 200; CORS autorizado para `https://api-pokemon.pages.dev` y sin `Access-Control-Allow-Origin` para `https://external.example`. Crear partida `standard` y `streak`, dos opciones, pista y resolución respondieron correctamente; la ronda activa no contiene `pokemon` ni nombre/ID secreto; `streak` finalizó ante respuesta incorrecta; partida standard incompleta no apareció en ranking.
Validación: smoke HTTP con `curl` y `jq` contra `https://api-pokemon.pages.dev` y `https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev/api`.
Estado: BLOQUEO CRÍTICO. Al encadenar 10 `POST /games/:id/guess` de una partida `standard` usando `nextRound`, las respuestas públicas regresaron a rondas anteriores (por ejemplo, 6 -> 4 -> 5) y nunca llegaron a `finished=true`; alternando `GET /games/:id` ocurrió la misma regresión. Evidencia compatible con estado en memoria del Worker sobrescribiendo/adelantando D1 entre isolates. Ranking de partida completa y timeout público no certificables; no se modificó código, no se hizo push ni despliegue.

### 2026-09-05 — Orchestrator -> backend
Tarea: corregir la fuente de verdad de rondas cuando existe binding D1 y evitar retrocesos entre isolates.
Resultado: GET consulta siempre D1; el `Map` queda solo para ejecución sin DB; las escrituras D1 son monotónicas por ronda y no reabren partidas finalizadas; el ranking usa el estado persistido.
Validación: `apps/api test` (18/18) y `apps/api typecheck` correctos; prueba nueva alterna GET/POST durante 10 rondas, verifica avance 1..10, `finished=true` y ranking.
Estado: aceptado; sin cambios frontend, push ni despliegue.

### 2026-09-05 — backend — despliegue y smoke público D1
Tarea: desplegar el Worker corregido y verificar públicamente la autoridad D1 en una partida standard de 10 rondas.
Resultado: Worker `https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev`, versión `66767100-eacf-46fd-a319-0bfd5b1d6ec1`; `/api/health`, `/api/openapi.json` y `/api/docs` HTTP 200; CORS de `https://api-pokemon.pages.dev` correcto.
Validación: partida `1c0b27a4-118c-4227-b58b-26a77cd7b800` alternó GET/POST con secuencia `1->2, 2->3, 3->4, 4->5, 5->6, 6->7, 7->8, 8->9, 9->10, 10->10`, sin retroceso; ronda 10 `finished=true`, estado final persistido y ranking con `rounds=10` y score `130`. `wrangler d1 migrations list --remote`: `No migrations to apply!`; typecheck y 18 tests backend correctos.
Estado: aceptado; sin cambios de código/frontend y sin push.

### 2026-09-06 — backend/orchestrator — publicación y smoke final
Tarea: publicar los 4 commits locales, desplegar el Worker con `apps/api/wrangler.toml` y verificar producción sin modificar frontend.
Resultado: `main` publicada en `origin/main`; Worker desplegado en https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev, versión `0abcc352-009e-438c-853d-c7d00c44c03d`; Pages configurado como origen CORS.
Validación: `npm run typecheck`; `npm --workspace apps/api test` (18/18); D1 remoto `No migrations to apply!`; health/OpenAPI/docs HTTP 200; preflight CORS HTTP 204, origen Pages autorizado y origen externo rechazado; partida standard alternando GET/POST 1..10, `finished=true`, ranking con 10 rondas y score 813. HEAD publicado: `31a9e7a`.
Estado: aceptado.

### 2026-09-05 — qa-release — smoke final público autorizado
Tarea: certificar Pages, Worker, CORS, contrato, flujo standard completo, streak, pistas, timeout, feedback responsive, secretos y reproducibilidad.
Resultado: `https://api-pokemon.pages.dev` y `https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev` respondieron correctamente; health/openapi/docs HTTP 200, contrato con `guess` y sin `finish`, CORS autorizado/no autorizado correcto y D1 remota sin migraciones pendientes. La partida standard alternó GET/POST sin regresiones (`1->2` ... `9->10`, `10->10`), terminó persistida y apareció en ranking; streak terminó con fallo y no apareció en ranking; opciones y pistas no expusieron Pokemon/nombre/ID.
Validación: `npm run typecheck`, `npm test` (18 API, 7 dominio, 4 E2E), `npm run build` y `git diff --check` correctos. Playwright público verificó 390 px y escritorio sin overflow, dos opciones, ausencia visible de `o escribe tu respuesta`, feedback de acierto/X/timeout y timeout real tras 31 s. `.env.example` no contiene valores secretos, no hay secretos versionados y el Worker reporta `production`.
Estado: listo para release; no se modificó código, no se hizo commit ni push.

### 2026-09-06 — backend delegado — verificación local del flujo de juego
Tarea: reproducir `POST /games -> POST /games/:id/guess -> GET /games/:id` en memoria y con D1 simulado, incluyendo PokéAPI y fallback.
Resultado: `nextRound` conservó `round`, `imageUrl` y exactamente dos `choices`; D1 conservó `choices_json` y GET devolvió las dos opciones tras alternar lecturas y respuestas. PokéAPI respondió correctamente en éxito y el backend sobrevivió a error HTTP, payload inválido y timeout mediante fallback; sin defecto backend reproducible.
Validación: `npm run test --workspace apps/api` y `npm test --workspace apps/api -- --reporter=verbose` (18/18); `npm run typecheck --workspace apps/api` correcto. No se tocó frontend, no hubo migraciones, push ni despliegue.

### 2026-09-06 — frontend — regresión tras guess
Tarea: comprobar la transición desde `guess` a `nextRound`, incluyendo ronda, opciones, imagen y controles durante la carga.
Resultado: corregido `game.round` para usar `nextRound.round`; el botón textual también permanece deshabilitado hasta `imageReady`. E2E cubre nueva `imageUrl`, dos nuevas opciones y estados disabled/enabled.
Validación: `npm run typecheck`, `npm --workspace apps/web run test` (6/6) y `npm run build`, todo correcto; cambios solo en `apps/web` y este registro. Sin push ni despliegue.
Estado: aceptado.

### 2026-09-05 — qa-release — actualización final del checklist
Tarea: reflejar la evidencia final de tests, E2E, migraciones, Worker, Pages, CORS y smoke público.
Resultado: todas esas áreas quedan en `Done`; solo permanecen pendientes el commit de release y el estado limpio previo al commit.
Validación: evidencia pública y local revisada en este archivo; no se desplegó, no se hizo commit ni push.
Estado: listo para release desde QA.

## Consolidación final de release — 2026-09-05

El bloqueo crítico histórico de regresión de rondas y el bloqueo alto de overflow responsive quedaron resueltos y verificados por las delegaciones posteriores de backend, frontend y qa-release. La evidencia final certifica Pages/Worker, D1, CORS, contrato, standard monotónico 1..10, streak, pistas, opciones, timeout, E2E responsive y ausencia de secretos; no se hizo push.

### 2026-09-06 — backend — verificación local de choices y D1
Tarea: inspeccionar `POST /games/:id/guess`, `migrations/0003_game_choices.sql` y el flujo inicial/`nextRound`.
Resultado: no se detectó defecto de runtime; `choices` contiene exactamente correcta y distractor, y el test D1 verifica lectura/escritura y propagación en `guess`/`nextRound`.
Validación: `npm --workspace apps/api test` (18/18) y `npm --workspace apps/api run typecheck` correctos; no se desplegó ni se hizo push.

### 2026-09-06 — qa-release — regresión local tras primera resolución
Tarea: validar `nextRound`, nueva silueta, `choices`, `imageReady`, controles deshabilitados y D1 local.
Resultado: `game.round`, `imageUrl` y `choices` usan `nextRound`; cada ronda muestra exactamente dos opciones; durante la carga de la segunda imagen las opciones y `Adivinar` permanecen deshabilitados y se habilitan tras `onLoad`, sin controles inutilizables.
Validación: `npm run typecheck` correcto; `npm test` correcto (18 API, 7 dominio, 6 E2E); `npm run build` correcto; `npm --workspace apps/web run test` correcto (6/6); D1 local: `No migrations to apply!`; `.env.example` sin valores secretos y ningún secreto trackeado. Sin push ni despliegue.
Estado: aceptado; sin hallazgos bloqueantes para este flujo.

### 2026-09-06 — frontend — fallback seguro de imagen en segunda ronda
Tarea: evitar que `imageReady` bloquee indefinidamente las respuestas cuando la silueta se retrasa o falla, manteniendo la imagen oculta cuando carga correctamente.
Resultado: `onError` muestra `Imagen no disponible. Puedes responder igualmente.` sin revelar el Pokemon; las opciones y el campo textual solo se bloquean durante el envío de la respuesta. E2E cubre transición a `nextRound`, imagen retrasada con selección habilitada e imagen fallida con resolución posterior.
Validación: `npm run typecheck`, `npm --workspace apps/web run test` (8/8), `npm run build`, `git diff --check` y comprobación manual automatizada del flujo completo; todo correcto. Cambios solo en frontend y este registro; no se tocó backend, no hubo push ni despliegue.

### 2026-09-06 — qa-release — ronda de release local autorizada
Tarea: ejecutar typecheck, tests, build, Playwright frontend, `git diff --check`, revisar D1/migraciones, secretos, puntuación y llamadas a PokéAPI.
Resultado: `nextRound` conserva ronda, imagen y dos `choices`; la segunda silueta puede retrasarse o fallar sin bloquear la selección; el cliente no llama PokéAPI ni calcula el puntaje. D1 local no tiene migraciones pendientes y las migraciones 0001-0003 están configuradas en Wrangler.
Validación: `npm run typecheck`, `npm test` (18 API, 7 shared, 8 Playwright), `npm run build`, `npm --workspace apps/web test` (8/8) y `git diff --check`, todo correcto; no hay secretos sensibles versionados.
Estado: sin bloqueos técnicos detectados en esta ronda; no se hizo push ni despliegue. El árbol conserva cambios locales previos en código y documentación.

### 2026-09-06 — frontend/qa-release — despliegue Pages y smoke público
Tarea: construir la versión actual con `VITE_API_URL` de producción, publicar `apps/web/dist` en Pages y verificar el flujo público responsive.
Resultado: deployment `https://a1021a2c.api-pokemon.pages.dev`; alias `https://api-pokemon.pages.dev` HTTP 200; bundle contiene `https://api-pokemon-api.carlosjaviermendezgutierrez.workers.dev/api`; Worker `/api/health` HTTP 200.
Validación: `npm run typecheck` correcto; `npm --workspace apps/web test` (10/10); `npm run build` correcto; build de producción con `VITE_API_URL` correcto; smoke Chromium público en escritorio (1280 px) y móvil (390 px): dos opciones en rondas 1 y 2, navegación `PK` al formulario y sin overflow horizontal.
Estado: aceptado; no se modificó backend ni se hizo push adicional.

### 2026-09-06 — qa-release — smoke público final autorizado
Tarea: repetir la validación final contra Pages y Worker, cubriendo health, OpenAPI, docs, CORS, flujo standard alternando GET/POST, ranking, streak, timeout, opciones, pistas, navegación PK, responsive y ausencia de PokéAPI directa.
Resultado: Pages y Worker HTTP 200; CORS autorizado para `https://api-pokemon.pages.dev` y sin cabecera para origen externo; OpenAPI/Swagger correctos; ronda activa sin `pokemon`; dos opciones y pistas sin nombre del objetivo; standard avanzó `1->2` hasta `10->10`, terminó y apareció en ranking; streak terminó ante fallo; timeout real devolvió `timedOut=true` y `points=0`; bundle sin `pokeapi.co`; Chromium público móvil 390 px y escritorio sin overflow, errores de consola ni llamadas directas a PokéAPI; PK volvió al formulario.
Validación: `npm run typecheck`; `npm test` (10 E2E, 18 API, 7 dominio); `npm run build`; smoke HTTP público con aserciones; smoke Chromium público. Sin cambios de código ni push.
Estado: producción lista desde QA; quedan únicamente acciones administrativas de commit/push fuera de esta delegación.

### 2026-09-06 — frontend delegado — resultado final, opciones y audio
Tarea: retirar la respuesta manual, mostrar `Es {pokemon.name}`, añadir resumen final con datos de API y audio Web Audio opcional.
Resultado: solo quedan dos opciones por ronda; el placeholder inicial es `Escribe tu nombre, ej. Ash`; el resumen usa `playerName`, `score`, `round` y `streak` sin calcular score en frontend; audio sintetizado activable/desactivable tras interacción.
Validación: `npm --workspace apps/web run typecheck`, `npm --workspace apps/web test` (12/12) y `npm --workspace apps/web run build`, todo correcto. Sin llamadas externas nuevas, push ni despliegue.
Estado: aceptado.
