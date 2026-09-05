# Decisiones de arquitectura

## ADR-001: PokéAPI como fuente de dominio

- Estado: aceptada.
- PokéAPI no requiere credenciales y ofrece tipos, habilidades, estadísticas e imágenes.
- El Worker la consume detrás de un adaptador.
- El frontend nunca la consulta directamente.

## ADR-002: Cloudflare Pages + Worker + D1

- Estado: aceptada.
- Pages sirve el frontend, Worker expone la API y D1 persiste partidas/ranking.
- Es suficiente para un MVP gratuito y evita servidores persistentes.
- `database_id` de producción queda pendiente de configurar.

## ADR-003: Dominio puro compartido

- Estado: aceptada.
- Pistas, puntuación y dificultad viven en `packages/shared` sin dependencias de infraestructura.
- Esto permite probar reglas sin Worker, navegador ni D1.

## ADR-004: Pistas deterministas en el MVP

- Estado: aceptada.
- Las pistas usan atributos de PokéAPI y no tienen coste ni dependencia de un LLM.
- Claude y OpenAI quedan como adaptadores opcionales posteriores.
- Toda pista debe pasar validación anti-spoiler.

## ADR-005: Sin autenticación

- Estado: aceptada para MVP.
- El ranking usa nombre anónimo validado.
- Login, perfiles e historial quedan fuera de alcance para proteger la entrega mínima.

## ADR-006: Swagger sin dependencia pesada

- Estado: aceptada.
- El Worker sirve el contrato en `/api/openapi.json` y una página Swagger UI en `/api/docs`.
- La interfaz carga los recursos de Swagger UI desde `unpkg.com`.

## ADR-007: Fallback de memoria local

- Estado: aceptada para desarrollo.
- Si no existe binding `DB`, el Worker usa memoria para pruebas locales.
- En producción el binding D1 es obligatorio y debe verificarse antes del despliegue.

## Riesgos abiertos

- La API actual resuelve una ronda y marca la partida como terminada; falta completar el flujo de 10 rondas.
- Debe crearse la base D1 real y reemplazarse el placeholder `database_id`.
- Deben probarse frontend y API en una URL pública.
