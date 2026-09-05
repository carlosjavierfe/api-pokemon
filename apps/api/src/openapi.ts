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
        responses: { "201": { description: "Partida creada" }, "400": { description: "Payload inválido" } },
      },
    },
    "/games/{id}": { get: { summary: "Consulta el estado público de una partida", parameters: [{ $ref: "#/components/parameters/GameId" }], responses: { "200": { description: "Estado público" }, "404": { description: "No encontrada" } } } },
    "/games/{id}/hints": { post: { summary: "Solicita una pista", parameters: [{ $ref: "#/components/parameters/GameId" }], responses: { "200": { description: "Pista generada" }, "409": { description: "Límite o partida finalizada" } } } },
    "/games/{id}/guess": {
      post: {
        summary: "Envía una respuesta",
        parameters: [{ $ref: "#/components/parameters/GameId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Guess" } } } },
        responses: { "200": { description: "Resultado de la ronda" }, "400": { description: "Payload inválido" } },
      },
    },
    "/scores": { get: { summary: "Consulta el ranking", responses: { "200": { description: "Ranking de puntuaciones" } } } },
  },
  components: {
    parameters: { GameId: { name: "id", in: "path", required: true, schema: { type: "string" } } },
    schemas: {
      CreateGame: { type: "object", required: ["playerName"], properties: { playerName: { type: "string", maxLength: 40 } } },
      Guess: { type: "object", required: ["answer"], properties: { answer: { type: "string", maxLength: 40 } } },
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