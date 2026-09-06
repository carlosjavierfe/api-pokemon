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

### 2026-09-05 — Orchestrator -> qa-release
Tarea: preparar release readiness con checklist de tests, E2E, migraciones, Worker, Pages, CORS, variables, smoke público y entrega.
Resultado: creado `docs/RELEASE_CHECKLIST.md` con estados y bloqueos explícitos; revisados `MEMORIA_PROYECTO.md`, `DECISIONS.md`, `README.md`, scripts, migraciones, `.env.example` y estado Git.
Validación: repositorio en `main` alineado con `origin/main`; no se desplegó, no se hizo commit y no se usó Git push. No se inventaron URLs ni resultados públicos.
Estado: checklist creado; release bloqueado hasta verificar D1/URLs públicas, `WEB_ORIGIN` de Pages y smoke público.

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
