export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "API Pokemon",
    version: "0.1.0",
    description: "API del juego de adivinanza Pokemon.",
  },
  servers: [{ url: "/api" }],
  paths: {
    "/health": { get: { summary: "Comprueba la salud de la API", responses: { "200": { description: "API disponible" } } } },
    "/games": {
      post: {
        summary: "Crea una partida",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateGame" } } } },
        responses: {
          "201": { description: "Partida creada", content: { "application/json": { schema: { $ref: "#/components/schemas/PublicGame" } } } },
          "400": { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "503": { description: "Datos externos o almacenamiento no disponibles", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/games/{id}": {
      get: {
        summary: "Consulta el estado público de una partida",
        parameters: [{ $ref: "#/components/parameters/GameId" }],
        responses: {
          "200": { description: "Estado público", content: { "application/json": { schema: { $ref: "#/components/schemas/PublicGame" } } } },
          "404": { description: "No encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "503": { description: "Almacenamiento no disponible", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/games/{id}/hints": {
      post: {
        summary: "Solicita una pista",
        parameters: [{ $ref: "#/components/parameters/GameId" }],
        responses: {
          "200": { description: "Pista generada", content: { "application/json": { schema: { $ref: "#/components/schemas/HintResponse" } } } },
          "404": { description: "No encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Límite o partida finalizada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "503": { description: "Almacenamiento no disponible", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/games/{id}/guess": {
      post: {
        summary: "Envía una respuesta",
        parameters: [{ $ref: "#/components/parameters/GameId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Guess" } } } },
        responses: {
          "200": { description: "Resultado de la ronda", content: { "application/json": { schema: { $ref: "#/components/schemas/GuessResponse" } } } },
          "400": { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "No encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Partida finalizada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "503": { description: "Datos externos o almacenamiento no disponibles", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/scores": {
      get: {
        summary: "Consulta el ranking standard",
        parameters: [{ name: "mode", in: "query", required: false, schema: { type: "string", enum: ["standard"], default: "standard" } }],
        responses: {
          "200": { description: "Ranking de partidas standard completadas en 10 rondas", content: { "application/json": { schema: { $ref: "#/components/schemas/ScoreList" } } } },
          "400": { description: "Modo de ranking no soportado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "503": { description: "Almacenamiento no disponible", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
  components: {
    parameters: { GameId: { name: "id", in: "path", required: true, schema: { type: "string" } } },
    schemas: {
      CreateGame: {
        type: "object",
        required: ["playerName"],
        properties: {
          playerName: { type: "string", maxLength: 40 },
          mode: { type: "string", enum: ["standard", "streak"], default: "standard", description: "standard: 10 rondas; streak: termina en el primer fallo o timeout" },
        },
      },
      Guess: { type: "object", description: "answer puede omitirse para resolver la ronda por timeout", properties: { answer: { type: "string", maxLength: 40 } } },
      PublicGame: {
        type: "object",
        required: ["id", "playerName", "mode", "difficulty", "round", "score", "streak", "status", "hints", "choices", "imageUrl", "startedAt"],
        properties: {
          id: { type: "string" }, playerName: { type: "string" }, mode: { type: "string", enum: ["standard", "streak"] },
          difficulty: { type: "string", enum: ["easy", "normal", "hard"] }, round: { type: "integer" }, score: { type: "integer" },
          streak: { type: "integer" }, status: { type: "string", enum: ["active", "finished"] }, hints: { type: "array", items: { type: "string" } },
          choices: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } }, imageUrl: { type: "string", format: "uri" }, startedAt: { type: "integer" },
        },
      },
      HintResponse: { type: "object", required: ["hint", "hintsUsed"], properties: { hint: { type: "string" }, hintsUsed: { type: "integer", minimum: 1, maximum: 3 } } },
      ScoreBreakdown: { type: "object", properties: { basePoints: { type: "integer" }, speedBonus: { type: "integer" }, hintPenalty: { type: "integer" }, streakMultiplier: { type: "number" }, totalPoints: { type: "integer" } } },
      GuessResponse: {
        type: "object",
        required: ["correct", "points", "score", "streak", "difficulty", "round", "finished", "timedOut", "scoreBreakdown", "pokemon", "nextRound", "choices"],
        properties: {
          correct: { type: "boolean" }, points: { type: "integer" }, score: { type: "integer" }, streak: { type: "integer" }, difficulty: { type: "string", enum: ["easy", "normal", "hard"] },
          round: { type: "integer" }, finished: { type: "boolean" }, timedOut: { type: "boolean" }, scoreBreakdown: { $ref: "#/components/schemas/ScoreBreakdown" },
          pokemon: { type: "object", required: ["id", "name", "imageUrl"], properties: { id: { type: "integer" }, name: { type: "string" }, imageUrl: { type: "string", format: "uri" } } },
          nextRound: { oneOf: [{ $ref: "#/components/schemas/NextRound" }, { type: "null" }] }, choices: { type: "array", items: { type: "string" } },
        },
      },
      NextRound: { type: "object", required: ["round", "startedAt", "imageUrl", "choices"], properties: { round: { type: "integer" }, startedAt: { type: "integer" }, imageUrl: { type: "string", format: "uri" }, choices: { type: "array", items: { type: "string" } } } },
      ScoreList: { type: "object", required: ["scores"], properties: { scores: { type: "array", items: { $ref: "#/components/schemas/Score" } } } },
      Score: { type: "object", required: ["playerName", "score", "rounds"], properties: { playerName: { type: "string" }, score: { type: "integer" }, rounds: { type: "integer", enum: [10] } } },
      Error: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
    },
  },
} as const;

export const swaggerHtml = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>API Pokemon - Swagger</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.onload=()=>SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger-ui'});</script>
</body></html>`;