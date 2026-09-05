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