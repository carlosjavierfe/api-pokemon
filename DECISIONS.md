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
- D1 de producción creada como `api-pokemon-db`; migración inicial aplicada.

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

## ADR-008: Partida de diez rondas

- Estado: aceptada.
- La respuesta intermedia mantiene la partida activa, limpia las pistas y genera el siguiente Pokemon.
- La ronda 10 marca la partida como finalizada y persiste el score en el ranking.
- El frontend ofrece continuar entre rondas y solo muestra nueva partida al terminar.

## ADR-009: Tiempo y selección de rondas

- Estado: aceptada.
- Cada ronda tiene un límite de 30 segundos; el Worker decide si expiró.
- El frontend muestra la cuenta atrás y envía una resolución vacía al llegar a cero.
- El pool inicial contiene los 151 Pokemon originales y no repite el ID inmediatamente anterior.

## ADR-010: Modos de partida

- Estado: aceptada.
- `standard` termina al completar 10 rondas.
- `streak` termina en el primer fallo o timeout y conserva la racha acumulada.
- El modo se persiste en D1 mediante `migrations/0002_game_mode.sql`.

## Riesgos abiertos

- Deben probarse frontend y API en una URL pública.
