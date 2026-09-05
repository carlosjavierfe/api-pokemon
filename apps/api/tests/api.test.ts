import { describe, expect, it, vi } from "vitest";
import app from "../src";

vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
  id: 25,
  name: "pikachu",
  types: [{ type: { name: "electric" } }],
  abilities: [{ ability: { name: "static" } }],
  height: 4,
  weight: 60,
  base_experience: 112,
}), { status: 200, headers: { "Content-Type": "application/json" } })));

const env = { ENVIRONMENT: "test" };

describe("game API", () => {
  it("allows the configured web origin through CORS", async () => {
    const response = await app.request("/api/health", { headers: { Origin: "http://localhost:5173" } }, env);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("handles CORS preflight", async () => {
    const response = await app.request("/api/games", { method: "OPTIONS", headers: { Origin: "http://localhost:5173" } }, env);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("exposes OpenAPI and Swagger documentation", async () => {
    const openApiResponse = await app.request("/api/openapi.json", {}, env);
    const openApi = await openApiResponse.json();
    expect(openApi.openapi).toBe("3.0.3");
    expect(openApi.paths).toHaveProperty("/games/{id}/guess");

    const docsResponse = await app.request("/api/docs", {}, env);
    expect(docsResponse.headers.get("Content-Type")).toContain("text/html");
    expect(await docsResponse.text()).toContain("swagger-ui");
  });

  it("creates a game without exposing the answer", async () => {
    const response = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Ash" }) }, env);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).not.toHaveProperty("pokemon");
    expect(body).toHaveProperty("imageUrl");
  });

  it("rejects an invalid player name", async () => {
    const response = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "" }) }, env);
    expect(response.status).toBe(400);
  });
});