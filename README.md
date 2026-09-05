# API Pokemon

Juego web de adivinanza Pokemon. El jugador identifica un Pokemon oculto, solicita pistas y recibe una puntuación que aparece en el ranking.

## Stack

- React + Vite + TypeScript.
- Cloudflare Worker + Hono.
- Cloudflare D1 para persistencia.
- PokéAPI consumida exclusivamente desde el backend.
- OpenAPI y Swagger UI.

## Estructura

```text
apps/web/       Frontend React
apps/api/       Worker API
packages/shared/ Dominio y tipos compartidos
migrations/     Migraciones D1
```

## Ejecutar localmente

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run dev:api
```

En otra terminal:

```bash
npm run dev:web
```

URLs locales:

- Frontend: `http://localhost:5173`
- API health: `http://localhost:8787/api/health`
- OpenAPI: `http://localhost:8787/api/openapi.json`
- Swagger UI: `http://localhost:8787/api/docs`

Vite redirige `/api` al Worker local.

## Validación

```bash
npm run typecheck
npm test
npm run build
```

## API

```text
GET  /api/health
POST /api/games
GET  /api/games/:id
POST /api/games/:id/hints
POST /api/games/:id/guess
GET  /api/scores?limit=20
GET  /api/openapi.json
GET  /api/docs
```

El frontend no consulta PokéAPI directamente. La respuesta correcta y el cálculo del puntaje permanecen en el Worker.

## D1 y Cloudflare

La migración está en `migrations/0001_initial.sql`. Antes de desplegar hay que:

1. Crear una base D1.
2. Sustituir `database_id` en `apps/api/wrangler.toml`.
3. Aplicar la migración con Wrangler.
4. Configurar `WEB_ORIGIN` con el dominio de Cloudflare Pages.

Sin binding D1, el Worker usa memoria para desarrollo y pruebas locales.

## Variables

Consulta `.env.example`. No subas `.env`, `.dev.vars`, tokens ni claves.

## Alcance MVP

Incluye partida, pistas deterministas, puntuación, ranking, API propia, persistencia preparada, responsive, CORS y Swagger. Autenticación, perfiles, modo infinito y proveedores LLM quedan fuera del MVP.

## Estado

El dominio, API P0, frontend, CORS, OpenAPI y modo de 10 rondas están implementados. Pendientes: crear la D1 real, desplegar y probar la URL pública.
