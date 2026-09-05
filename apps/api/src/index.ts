import { Hono } from "hono";
import type { Difficulty, GameState, PokemonFacts } from "@api-pokemon/shared";
import { buildHint, calculateRoundPoints, nextDifficulty } from "@api-pokemon/shared";
import { openApiDocument, swaggerHtml } from "./openapi";

type Bindings = {
  ENVIRONMENT: string;
  WEB_ORIGIN?: string;
  DB?: D1Database;
};

type Game = GameState & {
  id: string;
  playerName: string;
  pokemon: PokemonFacts;
  hints: string[];
  startedAt: number;
  status: "active" | "finished";
};

const pokemonPool = [25, 1, 4, 7];

const games = new Map<string, Game>();

export const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

app.use("*", async (context, next) => {
  const origin = context.req.header("Origin");
  const allowedOrigin = getAllowedOrigin(context.env, origin);
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });
  if (allowedOrigin) headers.set("Access-Control-Allow-Origin", allowedOrigin);
  if (context.req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  await next();
  if (allowedOrigin) {
    context.res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    context.res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    context.res.headers.set("Access-Control-Allow-Headers", "Content-Type");
    context.res.headers.set("Vary", "Origin");
  }
});

app.get("/health", (context) => {
  return context.json({ status: "ok", environment: context.env.ENVIRONMENT });
});

app.get("/openapi.json", (context) => context.json(openApiDocument));
app.get("/docs", (context) => new Response(swaggerHtml, { headers: { "Content-Type": "text/html; charset=UTF-8" } }));

app.post("/games", async (context) => {
  const payload = await readJson<{ playerName?: string }>(context.req);
  const playerName = payload?.playerName?.trim();

  if (!playerName || playerName.length > 40) {
    return context.json({ error: "playerName is required and must be 40 characters or fewer" }, 400);
  }

  const pokemonId = pokemonPool[Math.floor(Math.random() * pokemonPool.length)];
  const pokemon = await getPokemon(pokemonId);
  const game: Game = {
    id: crypto.randomUUID(),
    playerName,
    pokemon,
    hints: [],
    difficulty: "easy",
    round: 1,
    score: 0,
    streak: 0,
    startedAt: Date.now(),
    status: "active",
  };

  games.set(game.id, game);
  if (context.env.DB) await saveGame(context.env.DB, game);
  return context.json(publicGame(game), 201);
});

app.get("/games/:id", async (context) => {
  const game = await findGame(context.env.DB, context.req.param("id"));
  return game ? context.json(publicGame(game)) : context.json({ error: "Game not found" }, 404);
});

app.post("/games/:id/hints", async (context) => {
  const game = await findGame(context.env.DB, context.req.param("id"));
  if (!game) return context.json({ error: "Game not found" }, 404);
  if (game.status !== "active") return context.json({ error: "Game is finished" }, 409);
  if (game.hints.length >= 3) return context.json({ error: "Maximum hints reached" }, 409);

  const hint = buildHint(game.pokemon, (game.hints.length + 1) as 1 | 2 | 3);
  game.hints.push(hint);
  if (context.env.DB) await saveGame(context.env.DB, game);
  return context.json({ hint, hintsUsed: game.hints.length });
});

app.post("/games/:id/guess", async (context) => {
  const game = await findGame(context.env.DB, context.req.param("id"));
  if (!game) return context.json({ error: "Game not found" }, 404);
  if (game.status !== "active") return context.json({ error: "Game is finished" }, 409);

  const payload = await readJson<{ answer?: string }>(context.req);
  const answer = payload?.answer?.trim().toLowerCase();
  if (!answer || answer.length > 40) return context.json({ error: "answer is required" }, 400);

  const correct = answer === game.pokemon.name.toLowerCase();
  const elapsedSeconds = (Date.now() - game.startedAt) / 1000;
  const points = calculateRoundPoints({
    correct,
    elapsedSeconds,
    hintsUsed: game.hints.length,
    streak: game.streak,
  });
  const resolvedPokemon = game.pokemon;
  game.streak = correct ? game.streak + 1 : 0;
  game.score += points;
  game.difficulty = nextDifficulty(game.difficulty, correct, game.hints.length);
  const completed = game.round >= 10;
  game.status = completed ? "finished" : "active";
  game.round += completed ? 0 : 1;
  if (!completed) {
    game.pokemon = await getPokemon(nextPokemonId(game.pokemon.id));
    game.hints = [];
    game.startedAt = Date.now();
  }
  if (context.env.DB) await saveGame(context.env.DB, game, completed);

  return context.json({
    correct,
    points,
    score: game.score,
    streak: game.streak,
    difficulty: game.difficulty,
    round: game.round,
    finished: completed,
    pokemon: { id: resolvedPokemon.id, name: resolvedPokemon.name, imageUrl: pokemonImageUrl(resolvedPokemon.id) },
  });
});

app.get("/scores", async (context) => {
  if (context.env.DB) {
    const result = await context.env.DB.prepare(
      "SELECT player_name AS playerName, score, rounds FROM scores ORDER BY score DESC LIMIT 20",
    ).all<{ playerName: string; score: number; rounds: number }>();
    return context.json({ scores: result.results });
  }

  const scores = [...games.values()]
    .filter((game) => game.status === "finished")
    .sort((left, right) => right.score - left.score)
    .slice(0, 20)
    .map((game) => ({ playerName: game.playerName, score: game.score, rounds: game.round }));

  return context.json({ scores });
});

function publicGame(game: Game) {
  return {
    id: game.id,
    playerName: game.playerName,
    difficulty: game.difficulty,
    round: game.round,
    score: game.score,
    streak: game.streak,
    status: game.status,
    hints: game.hints,
    imageUrl: pokemonImageUrl(game.pokemon.id),
  };
}

async function findGame(database: D1Database | undefined, id: string): Promise<Game | undefined> {
  const memoryGame = games.get(id);
  if (memoryGame || !database) return memoryGame;

  const row = await database.prepare("SELECT * FROM games WHERE id = ?1").bind(id).first<DatabaseGame>();
  if (!row) return undefined;

  const game: Game = {
    id: row.id,
    playerName: row.player_name,
    pokemon: JSON.parse(row.pokemon_json) as PokemonFacts,
    hints: JSON.parse(row.hints_json) as string[],
    difficulty: row.difficulty as Difficulty,
    round: row.round,
    score: row.score,
    streak: row.streak,
    startedAt: row.started_at,
    status: row.status as Game["status"],
  };
  games.set(id, game);
  return game;
}

async function saveGame(database: D1Database, game: Game, saveScore = false): Promise<void> {
  await database.prepare(
    `INSERT INTO games
      (id, status, difficulty, round_count, score, streak, player_name, pokemon_json,
       hints_json, started_at, round, created_at, finished_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status, difficulty = excluded.difficulty,
       round_count = excluded.round_count, score = excluded.score,
       streak = excluded.streak, hints_json = excluded.hints_json,
       round = excluded.round, finished_at = excluded.finished_at`,
  ).bind(
    game.id,
    game.status,
    game.difficulty,
    game.round,
    game.score,
    game.streak,
    game.playerName,
    JSON.stringify(game.pokemon),
    JSON.stringify(game.hints),
    game.startedAt,
    game.round,
    new Date(game.startedAt).toISOString(),
    game.status === "finished" ? new Date().toISOString() : null,
  ).run();

  if (saveScore) {
    await database.prepare(
      "INSERT OR REPLACE INTO scores (id, game_id, player_name, score, rounds, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(game.id, game.id, game.playerName, game.score, game.round, new Date().toISOString()).run();
  }
}

type DatabaseGame = {
  id: string;
  status: string;
  difficulty: string;
  score: number;
  streak: number;
  player_name: string;
  pokemon_json: string;
  hints_json: string;
  started_at: number;
  round: number;
};

function pokemonImageUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function nextPokemonId(currentId: number): number {
  const currentIndex = pokemonPool.indexOf(currentId);
  return pokemonPool[(currentIndex + 1) % pokemonPool.length];
}

async function getPokemon(id: number): Promise<PokemonFacts> {
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!response.ok) throw new Error("Unable to load Pokemon");
  const data = await response.json() as {
    id: number;
    name: string;
    types: Array<{ type: { name: string } }>;
    abilities: Array<{ ability: { name: string } }>;
    height: number;
    weight: number;
    base_experience: number;
  };

  return {
    id: data.id,
    name: data.name,
    types: data.types.map((entry) => entry.type.name),
    abilities: data.abilities.map((entry) => entry.ability.name),
    height: data.height,
    weight: data.weight,
    baseExperience: data.base_experience,
  };
}

async function readJson<T>(request: { json: <Body = unknown>() => Promise<Body> }): Promise<T | null> {
  try {
    return await request.json<T>();
  } catch {
    return null;
  }
}

function getAllowedOrigin(bindings: Bindings, origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  const allowedOrigins = new Set(["http://localhost:5173", bindings.WEB_ORIGIN].filter(Boolean));
  return allowedOrigins.has(origin) ? origin : undefined;
}

export default app;