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
