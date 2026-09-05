import { describe, expect, it, vi } from "vitest";
import app from "../src";

const ROUND_TIME_LIMIT_SECONDS = 30;

vi.spyOn(Math, "random").mockReturnValue(0);
vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL) => {
  const id = Number(String(request).split("/").pop());
  const pokemon = id === 1
    ? { id: 1, name: "pikachu", type: "electric", ability: "static" }
    : { id, name: "bulbasaur", type: "grass", ability: "overgrow" };

  return new Response(JSON.stringify({
  id: pokemon.id,
  name: pokemon.name,
  types: [{ type: { name: pokemon.type } }],
  abilities: [{ ability: { name: pokemon.ability } }],
  height: 4,
  weight: 60,
  base_experience: 112,
}), { status: 200, headers: { "Content-Type": "application/json" } });
}));

const env = { ENVIRONMENT: "test" };
const failingDatabase = {
  prepare: () => { throw new Error("private D1 failure"); },
} as unknown as D1Database;

describe("game API", () => {
  it("allows the configured web origin through CORS", async () => {
    const response = await app.request("/api/health", { headers: { Origin: "http://localhost:5173" } }, env);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("does not allow an unknown web origin", async () => {
    const response = await app.request("/api/health", { headers: { Origin: "https://unknown.example" } }, env);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
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
    expect(openApi.paths).not.toHaveProperty("/games/{id}/finish");
    expect(openApi.components.schemas.CreateGame.properties.mode.enum).toEqual(["standard", "streak"]);
    expect(openApi.paths["/games"].post.responses["201"].content["application/json"].schema.$ref).toBe("#/components/schemas/PublicGame");
    expect(openApi.paths["/scores"].get.responses["200"].content["application/json"].schema.$ref).toBe("#/components/schemas/ScoreList");
    expect(openApi.paths["/games"].post.responses["503"].content["application/json"].schema.$ref).toBe("#/components/schemas/Error");

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
    expect(body.choices).toHaveLength(2);
    expect(new Set(body.choices).size).toBe(2);
  });

  it("rejects an invalid player name", async () => {
    const response = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "" }) }, env);
    expect(response.status).toBe(400);
  });

  it.each([
    ["HTTP error", new Response("upstream failure", { status: 503 })],
    ["invalid payload", new Response(JSON.stringify({ id: 1, name: "bulbasaur" }), { status: 200 })],
  ])("uses deterministic fallback for PokéAPI %s", async (_label, upstreamResponse) => {
    vi.mocked(fetch).mockResolvedValueOnce(upstreamResponse);
    const response = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Fallback" }) }, env);
    const body = await response.json() as { choices: string[]; pokemon?: unknown };

    expect(response.status).toBe(201);
    expect(body).not.toHaveProperty("pokemon");
    expect(body.choices).toContain("bulbasaur");
  });

  it("uses fallback when PokéAPI exceeds the timeout", async () => {
    vi.mocked(fetch).mockImplementationOnce(async (_request, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const response = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Timeout" }) }, env);

    expect(response.status).toBe(201);
  });

  it("returns controlled 503 when no fallback data exists", async () => {
    vi.mocked(Math.random).mockReturnValueOnce(0.999);
    vi.mocked(fetch).mockResolvedValueOnce(new Response("upstream failure", { status: 503 }));
    const response = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Unavailable" }) }, env);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Pokemon data unavailable" });
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("returns controlled 503 when D1 fails", async () => {
    const response = await app.request("/api/games/missing", {}, { ...env, DB: failingDatabase });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Storage unavailable" });
    expect(JSON.stringify(body)).not.toContain("private D1 failure");
  });

  it("rejects a guess after the round time limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const gameResponse = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Brock" }) }, env);
    const game = await gameResponse.json() as { id: string };

    vi.setSystemTime(new Date(`2026-01-01T00:00:${String(ROUND_TIME_LIMIT_SECONDS).padStart(2, "0")}.000Z`));
    const response = await app.request(`/api/games/${game.id}/guess`, { method: "POST", body: JSON.stringify({ answer: "pikachu" }) }, env);
    const result = await response.json() as { correct: boolean; points: number; timedOut: boolean };

    expect(result).toMatchObject({ correct: false, points: 0, timedOut: true });
    vi.useRealTimers();
  });

  it("runs the API game flow and advances to the next round", async () => {
    const gameResponse = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Misty" }) }, env);
    const game = await gameResponse.json() as { id: string };

    const hintResponse = await app.request(`/api/games/${game.id}/hints`, { method: "POST" }, env);
    expect(hintResponse.status).toBe(200);

    const guessResponse = await app.request(`/api/games/${game.id}/guess`, {
      method: "POST",
      body: JSON.stringify({ answer: "pikachu" }),
    }, env);
    expect(guessResponse.status).toBe(200);
    const guess = await guessResponse.json() as { finished: boolean; round: number; pokemon: { name: string }; nextRound: { round: number; imageUrl: string } | null; scoreBreakdown: { hintPenalty: number; totalPoints: number } };
    expect(guess.finished).toBe(false);
    expect(guess.round).toBe(2);
    expect(guess.pokemon.name).toBe("pikachu");
    expect(guess.scoreBreakdown).toMatchObject({ hintPenalty: 15, totalPoints: expect.any(Number) });
    expect(guess.nextRound).toMatchObject({ round: 2, imageUrl: expect.stringContaining("/2.png") });

    const nextGameResponse = await app.request(`/api/games/${game.id}`, {}, env);
    const nextGame = await nextGameResponse.json() as { status: string; round: number; hints: string[] };
    expect(nextGame.status).toBe("active");
    expect(nextGame.round).toBe(2);
    expect(nextGame.hints).toHaveLength(0);

    const scoresResponse = await app.request("/api/scores", {}, env);
    const scores = await scoresResponse.json() as { scores: Array<{ playerName: string }> };
    expect(scores.scores.some((score) => score.playerName === "Misty")).toBe(false);
  });

  it("finishes only after the tenth round", async () => {
    const gameResponse = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Brock" }) }, env);
    const game = await gameResponse.json() as { id: string };
    let finalResult: { finished: boolean; round: number } | undefined;

    for (let round = 1; round <= 10; round += 1) {
      const response = await app.request(`/api/games/${game.id}/guess`, {
        method: "POST",
        body: JSON.stringify({ answer: "pikachu" }),
      }, env);
      finalResult = await response.json() as { finished: boolean; round: number };
    }

    expect(finalResult).toMatchObject({ finished: true, round: 10 });
    const scoresResponse = await app.request("/api/scores", {}, env);
    const scores = await scoresResponse.json() as { scores: Array<{ playerName: string; rounds: number }> };
    expect(scores.scores.find((score) => score.playerName === "Brock")?.rounds).toBe(10);
  });

  it("finishes streak mode on the first wrong answer", async () => {
    const gameResponse = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Gary", mode: "streak" }) }, env);
    const game = await gameResponse.json() as { id: string; mode: string };
    expect(game.mode).toBe("streak");

    const response = await app.request(`/api/games/${game.id}/guess`, {
      method: "POST",
      body: JSON.stringify({ answer: "wrong-answer" }),
    }, env);
    const result = await response.json() as { finished: boolean; streak: number };
    expect(result).toMatchObject({ finished: true, streak: 0 });
  });

  it("returns only completed standard games with exactly ten rounds", async () => {
    const incompleteResponse = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Incomplete" }) }, env);
    const incompleteGame = await incompleteResponse.json() as { id: string };
    await app.request(`/api/games/${incompleteGame.id}/guess`, {
      method: "POST",
      body: JSON.stringify({ answer: "pikachu" }),
    }, env);

    const streakResponse = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Streak ranking exclusion", mode: "streak" }) }, env);
    const streakGame = await streakResponse.json() as { id: string };
    await app.request(`/api/games/${streakGame.id}/guess`, {
      method: "POST",
      body: JSON.stringify({ answer: "wrong-answer" }),
    }, env);

    const standardResponse = await app.request("/api/games", { method: "POST", body: JSON.stringify({ playerName: "Standard ranking" }) }, env);
    const standardGame = await standardResponse.json() as { id: string };
    for (let round = 1; round <= 10; round += 1) {
      await app.request(`/api/games/${standardGame.id}/guess`, {
        method: "POST",
        body: JSON.stringify({ answer: "pikachu" }),
      }, env);
    }

    const scoresResponse = await app.request("/api/scores?mode=standard", {}, env);
    const scores = await scoresResponse.json() as { scores: Array<{ playerName: string; rounds: number }> };
    expect(scores.scores).toContainEqual({ playerName: "Standard ranking", score: expect.any(Number), rounds: 10 });
    expect(scores.scores.some((score) => score.playerName === "Incomplete")).toBe(false);
    expect(scores.scores.some((score) => score.playerName === "Streak ranking exclusion")).toBe(false);
  });

  it("rejects unsupported ranking modes", async () => {
    const response = await app.request("/api/scores?mode=streak", {}, env);
    expect(response.status).toBe(400);
  });
});