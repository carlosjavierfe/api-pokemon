# Memoria técnica del proyecto

Documento breve de referencia. Solo contiene decisiones, lógica y datos necesarios para continuar el desarrollo.

## Estado actual

- Repositorio: `https://github.com/carlosjavierfe/api-pokemon`.
- Rama: `main`, sincronizada con GitHub.
- Git local inicializado; colaboradores históricos no afectan al proyecto.
- Monorepo creado y dependencias instaladas.
- `npm run typecheck`: correcto.
- `npm run build`: correcto.
- Dominio puro implementado y probado.
- API P0 implementada con almacenamiento en memoria para desarrollo local.
- Persistencia D1 integrada mediante binding `DB`; sin binding se usa memoria para tests locales.
- `database_id` real de Cloudflare aún debe configurarse antes del despliegue.
- Frontend jugable implementado con cliente API, pistas, respuesta, resultado y ranking.
- Proxy Vite configurado para `/api` local.

## Decisiones confirmadas

- API de dominio: PokéAPI.
- Frontend: React, Vite y TypeScript.
- Backend: Cloudflare Worker en TypeScript.
- Persistencia: Cloudflare D1.
- Frontend desplegado en Cloudflare Pages; API en Worker separado.
- OpenAPI + Swagger UI en `/api/docs`.
- MVP sin autenticación; ranking con nombre anónimo validado.
- Repositorio público para facilitar evaluación.
- Pistas del MVP: proveedor determinista, sin coste ni dependencia externa.
- Claude y OpenAI quedan como adaptadores opcionales posteriores; no se asume API gratuita.
- No se usarán secretos en Git. Las claves futuras irán en secrets de Cloudflare.
- No se crearán microservicios.

## Estructura

```text
apps/web/                 # React/Vite
apps/api/                 # Cloudflare Worker
packages/shared/          # tipos y contratos compartidos
migrations/               # SQL de D1
.github/agents/           # agentes personalizados
.github/skills/           # skills reutilizables
```

## Arquitectura y límites

```text
Browser -> Cloudflare Pages -> Worker API -> D1
                                      -> PokéAPI
                                      -> proveedor de pistas opcional
```

- `web`: interacción, temporizador, imagen oculta, estados y ranking.
- `api`: seguridad, partidas, selección, pistas, puntuación y persistencia.
- `domain`: reglas puras, sin dependencias de infraestructura.
- `adapters`: PokéAPI, D1, proveedor de pistas y Swagger.
- `shared`: tipos de requests y responses.

El frontend nunca consulta PokéAPI directamente. El cliente nunca recibe el nombre o ID secreto mientras la ronda está activa. El backend calcula el resultado final.

## Bucle y reglas del juego

```text
crear partida -> presentar Pokemon oculto -> pedir pista/adivinar
-> resolver ronda -> calcular puntos -> repetir -> guardar ranking
```

- Partida MVP: 10 rondas.
- Hasta 3 pistas por ronda.
- Pista 1: tipo o categoría.
- Pista 2: habilidad o rango de estadísticas.
- Pista 3: altura, peso u otro atributo no nominal.
- Las pistas no pueden contener nombre, slug ni ID del objetivo; si fallan la validación, se usa plantilla determinista.
- Puntuación: base por acierto, bonus por velocidad, multiplicador de racha y penalización por pistas/tiempo.
- Dificultad: `easy`, `normal`, `hard`.
- Aciertos consecutivos suben dificultad; fallos o uso elevado de pistas la reducen, dentro de esos límites.
- El cálculo de puntos y dificultad ocurre en el Worker.

## API mínima

```text
GET  /api/health
POST /api/games
GET  /api/games/:id
POST /api/games/:id/guess
POST /api/games/:id/hints
POST /api/games/:id/finish
GET  /api/scores?limit=20
GET  /api/docs
```

Payloads deben validarse y limitarse. Errores de PokéAPI, D1 y proveedor de pistas deben devolver respuestas controladas.

## Modelo D1

```text
games:
  id, status, difficulty, round_count, score, streak, created_at, finished_at

rounds:
  id, game_id, pokemon_id, difficulty, hints_used, guessed, points,
  created_at, resolved_at

scores:
  id, game_id, player_name, score, rounds, created_at
```

Migración actual: `migrations/0001_initial.sql`.

## Agentes y autorización

Agentes configurados:

- `orchestrator`: coordina backlog, contratos, entregas y validación.
- `architecture`: decisiones, contratos y modelo de datos.
- `backend`: Worker, D1, PokéAPI y lógica de servidor.
- `frontend`: React, estados, accesibilidad y responsive.
- `qa-release`: pruebas, seguridad, documentación y despliegue.

Skills configurados:

- `requirements`
- `cloudflare-backend`
- `game-frontend`
- `qa-release`

Regla obligatoria: todo agente debe explicar la acción y esperar autorización explícita antes de editar, crear, ejecutar, instalar, usar Git o desplegar. Debe leer esta memoria antes de cambios de arquitectura.

Hasta ahora la configuración de agentes está creada, pero las tareas han sido coordinadas directamente; todavía no se ha delegado una implementación completa a un agente especializado.

## Seguridad

- No subir `.env`, `.dev.vars`, tokens ni claves.
- Usar `.env.example` sin valores secretos.
- Mantener la respuesta correcta en Worker/D1.
- Validar nombre de jugador, IDs, límites y frecuencia de requests.
- Configurar CORS para el dominio de Pages.
- Usar timeout y fallback cuando PokéAPI no responda.

## Próximo orden de implementación

1. Añadir CORS controlado para Pages y Swagger/OpenAPI.
2. Añadir pruebas de integración visual/API.
3. Ejecutar pruebas, documentar y desplegar.

## Comandos

```bash
npm install
npm run typecheck
npm run build
npm run dev:web
npm run dev:api
```

Commits incrementales: `feat(domain): ...`, `feat(api): ...`, `feat(web): ...`, `test(...): ...`, `docs: ...`, `chore(deploy): ...`.
