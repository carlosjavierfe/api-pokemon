# Memoria del proyecto: Wiki API Pokemon

> Documento vivo de análisis, decisiones y coordinación. Se actualiza a medida que el proyecto avance.

## 1. Estado inicial

- Fecha de análisis: 2026-09-05.
- Carpeta de trabajo: `wiki-api-pokemon`.
- Estado actual: únicamente está disponible `prueba-tecnica-candidatos.html`.
- Git: todavía no está inicializado.
- Fecha límite indicada por la prueba: 7 de septiembre, 10:00 a. m.
- Tiempo de referencia: aproximadamente 24 horas efectivas.

## 2. Lectura de la prueba

El producto es un juego web de adivinanza: se presenta un Pokemon oculto, el jugador intenta identificarlo, puede pedir hasta tres pistas progresivas y al final se calcula y persiste el puntaje para mostrar un ranking.

### Requisitos obligatorios

1. Frontend jugable que consuma PokéAPI y muestre imágenes/datos reales.
2. Estados de carga y error visibles.
3. IA con valor real: pistas y/o dificultad adaptativa.
4. Las pistas no pueden revelar el nombre del Pokemon.
5. Fallback si el servicio de IA falla.
6. Backend propio con endpoints de puntajes/ranking.
7. Persistencia durable.
8. Uso documentado de agentes en `AI_USAGE.md`.
9. Tablero ágil visible e historial de commits incremental.
10. `README.md`, `.env.example` y `DECISIONS.md` o ADRs.
11. Secretos fuera del repositorio y manejo de errores más allá del camino feliz.

### Criterio de alcance

La prueba premia una entrega completa, entendible y defendible por encima de muchas funcionalidades incompletas. El MVP debe cerrar el bucle completo antes de añadir pulido:

`iniciar partida -> presentar Pokemon oculto -> pedir/adivinar -> resolver -> puntuar -> guardar -> ranking`

## 3. Decisiones iniciales

### API de dominio

Usaremos **PokéAPI** en lugar de Marvel:

- No requiere credenciales ni firma.
- Tiene tipos, habilidades, estadísticas, altura, peso y sprites suficientes para pistas.
- Reduce el riesgo operativo dentro del límite de tiempo.
- El backend será el único responsable de consultar y cachear la API pública para evitar que cada cliente la golpee directamente.

### Stack propuesto

- **Frontend:** React + Vite + TypeScript.
- **API:** Cloudflare Worker en TypeScript.
- **Documentación API:** OpenAPI + Swagger UI, publicada en `/api/docs`.
- **Persistencia:** Cloudflare D1, SQLite administrado por Cloudflare.
- **Hosting:** Cloudflare Pages o assets estáticos servidos junto al Worker.
- **Pruebas:** Vitest para dominio y API; pruebas manuales/e2e del flujo principal si el tiempo lo permite.
- **Validación:** Zod o validación equivalente en los límites HTTP.
- **Estilo:** una interfaz web responsive, accesible y enfocada en el juego.

La aplicación se organizará como monorepo sencillo:

```text
wiki-api-pokemon/
  apps/
    web/                 # React/Vite
    api/                 # Worker: endpoints, dominio y adaptadores
  packages/
    shared/              # Tipos y contratos compartidos
  migrations/            # SQL de D1
  docs/
  README.md
  DECISIONS.md
  AI_USAGE.md
  .env.example
  package.json
  wrangler.toml
```

No se dividirá en microservicios: para este reto añadirían despliegues y fallos sin aportar valor demostrable.

## 4. Arquitectura de ejecución

```text
Browser (React)
        |
        | HTTPS / JSON
        v
Cloudflare Worker API
  |-- Game service: partidas, rondas, puntuación y dificultad
  |-- Pokemon adapter: PokéAPI + cache
  |-- Hint service: proveedor IA + fallback heurístico
  |-- Score repository: D1
        |
        +--> PokéAPI
        +--> proveedor IA configurable
        +--> Cloudflare D1
```

### Límites de responsabilidad

- **Web:** interacción, temporizador visual, ocultación de imagen, estado de carga/error y ranking.
- **Worker:** no confiar en el cliente para Pokemon correcto, coste de pistas ni puntaje final.
- **Dominio:** reglas puras de selección, validación de respuestas, racha, penalizaciones y dificultad.
- **Adaptadores:** traducir PokéAPI, proveedor IA y D1 a interfaces internas.
- **Shared:** contratos de request/response para evitar que frontend y backend diverjan.

### Seguridad mínima

- El cliente nunca recibe la respuesta antes de resolver la ronda.
- La respuesta correcta y la semilla/selección de ronda se mantienen en el Worker.
- El puntaje final se calcula en backend; el cliente solo lo solicita.
- Las claves de IA, si existen, viven en secrets de Cloudflare, nunca en `.env` versionado.
- Validar nombre, longitud, frecuencia y payload de cada endpoint.
- Añadir rate limiting sencillo por IP o una protección equivalente si el proveedor elegido lo permite.

## 5. Contrato funcional mínimo

### Endpoints previstos

```text
GET  /api/health
POST /api/games                    # crea partida y primera ronda
GET  /api/games/:id                # estado público de partida
POST /api/games/:id/guess          # registra respuesta y resuelve ronda
POST /api/games/:id/hints          # solicita la siguiente pista
POST /api/games/:id/finish         # cierra y persiste el puntaje
GET  /api/scores?limit=20          # ranking
GET  /api/docs                     # Swagger UI / documentación interactiva
```

El contrato público no debe incluir `name` ni el identificador secreto del Pokemon mientras una ronda esté activa.

### Modelo D1 inicial

```text
games
  id, status, difficulty, round_count, score, streak, created_at, finished_at

rounds
  id, game_id, pokemon_id, difficulty, hints_used, guessed, points, created_at, resolved_at

scores
  id, game_id, player_name, score, rounds, created_at
```

Para el MVP se puede usar un nombre de jugador sin autenticación. Es suficiente para el ranking de la prueba; la autenticación queda fuera de alcance y se documenta como siguiente paso.

## 6. IA, fallback y dificultad

### Diseño recomendado

La interfaz de dominio será equivalente a:

```text
HintProvider.generate(pokemonFacts, hintLevel, difficulty) -> safeHint
```

El adaptador IA recibirá únicamente datos necesarios y tendrá instrucciones estrictas: no usar el nombre, slug, ID ni una combinación que lo revele; responder una sola pista breve en español.

El **fallback determinista** usará plantillas con atributos permitidos:

- Pista 1: tipo o categoría.
- Pista 2: habilidad o rango de estadísticas.
- Pista 3: altura/peso u otro dato no nominal.

Antes de guardar/mostrar una pista se ejecutará una comprobación de seguridad: no debe contener el nombre objetivo ni su slug. Si falla, se sustituye por plantilla.

La dificultad del MVP será una máquina de estados pequeña:

- `easy`: Pokemon conocido y pistas más informativas.
- `normal`: selección equilibrada y penalización estándar.
- `hard`: atributos menos obvios y mayor penalización.

Después de cada ronda, una racha de aciertos aumenta un nivel; un fallo o varias pistas usadas reduce el nivel, con límites `easy..hard`. La regla será determinista y se cubrirá con pruebas.

## 7. Agentes de desarrollo y orquestador

Aquí distinguimos dos conceptos:

1. **Orquestador de agentes:** coordina el trabajo de desarrollo, revisa artefactos y decide cuándo avanzar.
2. **Orquestador de partida:** servicio de dominio que controla las rondas del juego en tiempo de ejecución.

### Agentes propuestos

| Agente | Responsabilidad | Entrega verificable |
|---|---|---|
| Analista de requisitos | Convertir la prueba en historias, criterios y fuera de alcance | tablero y checklist |
| Arquitecto | Contratos, límites, decisiones y riesgos | `DECISIONS.md`, diagramas |
| Frontend | Flujo jugable, estados, accesibilidad y responsive | `apps/web` + pruebas |
| Backend/Cloudflare | Worker, endpoints, D1, secrets y despliegue | `apps/api`, migraciones, `wrangler.toml` |
| IA de juego | Prompt, adaptador, validación anti-spoiler y fallback | servicio de pistas + pruebas |
| QA/seguridad | Casos límite, contratos, secretos y smoke tests | checklist y reporte |
| Documentación/release | README, `AI_USAGE.md`, demo y preparación de entrega | documentos y release checklist |

### Reglas del orquestador

- Mantener un backlog único y priorizado.
- Entregar contexto explícito al agente: objetivo, archivos permitidos, contrato y criterio de aceptación.
- Un agente no modifica el contrato compartido sin registrar una decisión.
- Cada entrega debe incluir pruebas o una justificación concreta si no aplica.
- El orquestador ejecuta validación después de cada hito: typecheck, lint, tests y smoke test.
- No aceptar código que introduzca secretos, lógica de puntaje solo en frontend o dependencia directa del frontend con PokéAPI.
- Los agentes pueden proponer; el orquestador integra y el responsable humano revisa los cambios.
- Registrar prompts relevantes, resultado, cambios aceptados/descartados y motivo en `AI_USAGE.md`.

### Secuencia de trabajo del orquestador

```text
Analizar -> diseñar contrato -> implementar dominio -> conectar API/D1
         -> implementar frontend -> integrar IA/fallback -> probar
         -> documentar -> desplegar -> demo y revisión final
```

No hace falta construir un sistema autónomo de agentes para la prueba. La evidencia importante es el uso deliberado, trazable y verificado de agentes, no la cantidad de agentes.

## 8. Plan de implementación por prioridad

### P0: producto demostrable

1. Inicializar npm, TypeScript, React/Vite, Worker y Git.
2. Crear tablero y dividir historias.
3. Implementar reglas puras de partida, respuesta y puntuación.
4. Crear Worker con `/health`, crear partida, adivinar y ranking.
5. Crear migración D1 y persistencia de scores.
6. Conectar PokéAPI mediante backend y agregar cache básica.
7. Construir una pantalla jugable con carga, error, temporizador y Pokemon oculto.

### P1: requisito de IA y calidad

8. Añadir pistas progresivas con `HintProvider` y fallback determinista.
9. Añadir dificultad adaptativa y pruebas de reglas.
10. Validar endpoints, ocultar secretos, controlar errores y limitar payloads.
11. Cubrir el flujo principal con pruebas y ejecutar un smoke test local.

### P2: entrega y despliegue

12. Completar `README.md`, `DECISIONS.md`, `AI_USAGE.md` y `.env.example`.
13. Crear commits pequeños por incremento y revisar el diff completo.
14. Desplegar frontend/API/D1 en Cloudflare.
15. Ejecutar partida real en producción y preparar demo de máximo 3 minutos.

Si el tiempo se reduce, se recorta diseño visual, autenticación, histórico detallado y modo infinito; no se recortan backend, persistencia, fallback, documentación ni el flujo completo.

## 9. Git y tablero

### Inicialización

Desde `wiki-api-pokemon`:

```bash
git init
git add prueba-tecnica-candidatos.html MEMORIA_PROYECTO.md
git commit -m "docs: documentar reto y arquitectura inicial"
```

Después se añadirá un repositorio remoto de GitHub y se trabajará en `main` con commits pequeños, dado el plazo corto. No se deben subir `.env`, claves ni artefactos generados.

### Convención de commits

Usar mensajes claros y agrupados por incremento:

```text
feat(domain): implementar reglas de puntuacion
feat(api): agregar endpoint de ranking
feat(web): completar flujo de partida
test(domain): cubrir dificultad adaptativa
docs: registrar uso de agentes
chore(deploy): configurar Cloudflare
```

El tablero debe tener al menos `Backlog`, `Ready`, `In progress`, `Review`, `Done`, con historias de usuario y criterios de aceptación. Las tareas P0 deben estar visibles desde el inicio.

## 10. Cloudflare gratuito

### Objetivo de despliegue

- **Frontend:** Cloudflare Pages conectado al repositorio o deploy mediante Wrangler.
- **API:** Cloudflare Worker bajo `/api/*` o un Worker separado.
- **Base de datos:** D1 con migraciones versionadas.
- **Secretos:** `wrangler secret put` para la clave del proveedor IA.
- **Variables públicas:** configuración no sensible en `wrangler.toml` o variables de entorno del build.

La arquitectura evita servidores persistentes y usa servicios adecuados para un MVP de bajo tráfico. Antes de cerrar la entrega hay que revisar los límites gratuitos vigentes de Pages, Workers, D1 y del proveedor de IA, porque pueden cambiar; el fallback permite demostrar el juego aunque la IA no esté disponible.

### Checklist de despliegue

- [ ] Cuenta Cloudflare creada y proyecto vinculado.
- [ ] D1 creada para el entorno de producción.
- [ ] Migraciones aplicadas y endpoint `/api/health` verde.
- [ ] Variables y secrets configurados sin aparecer en Git.
- [ ] CORS restringido al dominio frontend.
- [ ] Build de frontend reproducible desde README.
- [ ] Partida completa probada en URL pública.
- [ ] Ranking persistido probado tras recargar.
- [ ] URL añadida a README y preparada para la sustentación.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| PokéAPI lenta o caída | cache, timeout, datos mínimos y mensaje de reintento |
| IA lenta, cara o caída | timeout corto, fallback determinista y proveedor intercambiable |
| IA revela el Pokemon | prompt restringido, filtro de nombre/slug y sustitución por plantilla |
| Cliente falsifica puntaje | cálculo y resolución en Worker |
| Límite gratuito de Cloudflare | MVP sin polling, payloads pequeños y consultar cuotas antes del demo |
| Tiempo insuficiente | priorizar P0 y conservar fuera de alcance documentado |
| Código generado no entendido | revisión humana y `AI_USAGE.md` con validaciones |

## 12. Respuestas acordadas y alcance para hoy

### Decisiones confirmadas el 2026-09-05

- Swagger/OpenAPI forma parte del MVP.
- El proveedor activo de pistas será determinista y no tendrá coste por petición.
- Se dejarán adaptadores opcionales para Claude de Anthropic y OpenAI.
- El repositorio GitHub será público.
- No habrá autenticación en el MVP.
- El despliegue será Cloudflare Pages + Worker separado + D1.
- Todos los agentes deben pedir autorización explícita antes de actuar.

### Proveedor de IA y uso de Copilot

Trabajaremos en Visual Studio Code usando **GitHub Copilot** como agente de desarrollo. Esto cubre el requisito de documentar agentes, pero hay que distinguirlo de la IA del producto:

- Copilot nos ayuda a analizar, diseñar, escribir, revisar y probar el código.
- Copilot no será llamado desde la web para generar pistas durante una partida.
- Para entregar hoy, las pistas se generarán mediante un `HintProvider` determinista con datos de PokéAPI.
- Dejaremos adaptadores preparados para Claude de Anthropic y OpenAI sin cambiar el juego.
- Ninguno de esos proveedores se considera gratuito de forma universal: su disponibilidad depende de créditos y facturación de la cuenta.
- En `AI_USAGE.md` registraremos prompts, cambios aceptados, cambios descartados y validaciones realizadas con Copilot.

Esta decisión reduce costes, latencia y riesgo de que una clave secreta o una respuesta del modelo falle durante la demo. Cumple el requisito funcional porque la prueba permite IA heurística/ML bien justificada.

### Repositorio GitHub

Usaremos un repositorio **público** del usuario. Es la opción más conveniente para que los evaluadores puedan revisar el código y para mostrar el historial incremental. Cloudflare también puede conectarse a repositorios privados, pero no lo necesitamos para este reto. No se subirán secretos, aunque el repositorio sea público.

### Autenticación

El MVP no tendrá autenticación. El ranking usará un nombre anónimo validado y un identificador de partida generado por el backend.

La autenticación queda como mejora posterior, junto con perfiles, historial personal y protección contra suplantación. No se implementará hoy porque no es necesaria para el entregable mínimo y puede poner en riesgo el flujo principal.

### Despliegue recomendado

Para este reto usaremos **Cloudflare Pages para el frontend y Cloudflare Worker separado para la API**, con D1 para persistencia y Swagger UI para documentar la API:

```text
Cloudflare Pages (React/Vite) -> Cloudflare Worker (/api/*) -> Cloudflare D1
                                                       -> PokéAPI
                                      -> /api/docs (Swagger UI)
```

Es más fácil de entender y defender que mezclar assets y API en un único Worker. También permite desplegar el frontend desde GitHub y mantener la API con sus variables y secretos separados. Swagger añade una documentación navegable y facilita probar los endpoints durante la sustentación. Si el tiempo obliga a simplificar, el frontend puede apuntar temporalmente al Worker desplegado en una URL pública.

### Qué significa estilo visual

“Estilo visual para la sustentación” significa elegir una dirección de diseño coherente y poder explicar por qué ayuda al juego. No se espera una marca compleja. Para el MVP usaremos una **Pokédex contemporánea**:

- Fondo claro y contraste alto para lectura rápida.
- Acentos inspirados en tipos Pokemon, sin saturar la pantalla.
- Panel principal centrado en la silueta, la pista, el campo de respuesta y el contador.
- Estados visibles de carga, error, acierto y fallo.
- Diseño responsive para móvil y escritorio.
- Tipografía legible, botones claros y animaciones discretas.

La defensa puede resumirlo así: “Priorizamos una interfaz de juego rápida y legible; la imagen oculta es el foco, y la información secundaria no compite con la decisión del jugador”.

## 13. Arquitectura práctica de agentes

No construiremos siete agentes autónomos. Con el tiempo disponible, usaremos **un orquestador principal y cuatro agentes especializados**, todos coordinados por Copilot. Es suficiente para dejar evidencia clara y mantener el control humano.

### Orquestador principal

**Responsabilidad:** mantener el backlog, repartir tareas, revisar cambios y decidir cuándo una tarea pasa a la siguiente etapa.

**Instrucciones:**

1. Leer `MEMORIA_PROYECTO.md` antes de proponer cambios.
2. Priorizar el flujo jugable completo sobre mejoras secundarias.
3. No aceptar secretos, lógica de puntaje únicamente en frontend ni llamadas directas del frontend a PokéAPI.
4. Asignar una tarea concreta a un agente por vez, con archivos permitidos y criterio de aceptación.
5. Exigir validación después de cada hito: typecheck, tests, lint o smoke test.
6. Mantener cambios pequeños y commits incrementales.
7. Registrar decisiones y uso de Copilot en `DECISIONS.md` y `AI_USAGE.md`.
8. Preguntar al usuario y esperar un “sí” explícito antes de editar, ejecutar, instalar, hacer Git o desplegar.

### Agente 1: producto y arquitectura

- Convierte la prueba en historias y criterios de aceptación.
- Define contratos HTTP, modelo D1 y límites entre web, API y dominio.
- Actualiza `DECISIONS.md`.

**Skill:** análisis de requisitos, diseño de contratos, threat modeling básico y documentación técnica.

### Agente 2: dominio y backend

- Implementa partida, rondas, puntuación, racha y dificultad.
- Implementa Worker, validación de payloads, PokéAPI adapter, endpoints y D1.
- Mantiene la respuesta correcta fuera del payload público.

**Skill:** TypeScript, APIs HTTP, Cloudflare Workers, D1/SQLite, validación y manejo de errores.

### Agente 3: frontend

- Implementa la pantalla jugable, temporizador, imagen oculta, pistas, respuesta y ranking.
- Consume únicamente el backend propio.
- Cuida responsive, accesibilidad, carga y errores.

**Skill:** React, Vite, TypeScript, CSS responsive, accesibilidad y estados asíncronos.

### Agente 4: QA, seguridad y release

- Prueba reglas y endpoints.
- Busca spoilers en pistas, puntajes falsificables, secretos y errores de red.
- Ejecuta smoke test local y producción.
- Completa README, `.env.example`, `AI_USAGE.md` y checklist de despliegue.

**Skill:** testing, revisión de seguridad, integración, Git y Cloudflare deployment.

## 14. Cómo crear agentes y skills en este proyecto

Las personalizaciones compartidas del proyecto vivirán en `.github/`. No es necesario crear un agente por cada tarea; basta con cuatro archivos de agente y cuatro skills reutilizables. Todos deben consultar al usuario antes de realizar cualquier acción.

### Estructura

```text
.github/
  agents/
    orchestrator.agent.md
    architecture.agent.md
    backend.agent.md
    frontend.agent.md
    qa-release.agent.md
  skills/
    requirements/SKILL.md
    cloudflare-backend/SKILL.md
    game-frontend/SKILL.md
    qa-release/SKILL.md
  instructions/
    project.instructions.md
```

### Agente personalizado

Cada archivo `.agent.md` debe tener frontmatter YAML con `name`, `description` y, cuando convenga, las herramientas permitidas. El cuerpo debe indicar misión, contexto que debe leer, restricciones, proceso y formato de entrega.

Plantilla mínima:

```markdown
---
name: backend
description: Implementa y prueba la API Cloudflare Worker y D1 del juego Pokemon.
---

# Misión
Trabaja solo en el backend y conserva los contratos compartidos.

# Antes de empezar
Lee `MEMORIA_PROYECTO.md`, `DECISIONS.md` y los contratos de `packages/shared`.

# Reglas
- No expongas la respuesta correcta mientras la ronda esté activa.
- No pongas secretos en el repositorio.
- Valida entradas y maneja errores de PokéAPI/D1.

# Entrega
Resume archivos modificados, pruebas ejecutadas, riesgos y decisiones pendientes.
```

En VS Code se seleccionan desde el selector de agente del chat. El nombre y la descripción deben ser específicos, porque la descripción es lo que permite encontrar el agente correcto.

### Skill reutilizable

Un skill es una guía bajo demanda para un flujo repetible. El archivo debe llamarse exactamente `SKILL.md` dentro de una carpeta cuyo nombre describa la capacidad.

Plantilla mínima:

```markdown
---
name: cloudflare-backend
description: Usa este skill al crear endpoints, migraciones D1 o despliegues de Cloudflare.
---

# Objetivo
Implementar un backend verificable para el juego.

# Checklist
- Revisar contrato.
- Validar payloads.
- Escribir prueba del camino feliz y un error.
- Ejecutar typecheck y tests.
- Documentar variables sin secretos.
```

Los agentes pueden apoyarse en los skills, pero el skill no reemplaza la revisión humana ni la ejecución de pruebas. Primero crearemos la estructura y los archivos mínimos; después los enriqueceremos solo cuando una tarea real revele una necesidad.

## 15. Plan de trabajo hasta mañana

### Hoy: entregar el mínimo defendible

1. Crear estructura del monorepo e inicializar Git.
2. Implementar dominio de partida y pruebas.
3. Implementar Worker con partida, adivinanza y ranking.
4. Crear D1 y conectar PokéAPI desde backend.
5. Crear frontend funcional y responsive.
6. Añadir pistas deterministas y dificultad adaptativa.
7. Completar documentación y hacer commits incrementales.

### Mañana: publicar y verificar

1. Crear/conectar repositorio GitHub público.
2. Desplegar API, D1 y frontend en Cloudflare.
3. Probar una partida completa desde la URL pública.
4. Confirmar que el ranking sobrevive a una recarga.
5. Añadir URL, límites y decisiones al README.

### Fuera del MVP

- Registro y login.
- Perfiles e historial personal.
- Modo infinito.
- Chat con IA.
- Panel administrativo.
- Animaciones complejas.

Estas mejoras pueden añadirse después sin modificar el núcleo si se conservan las interfaces de dominio y los contratos HTTP.