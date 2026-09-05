import { Hono } from "hono";
import type { Difficulty, GameState, PokemonFacts } from "@api-pokemon/shared";
import { buildHint, calculateRoundScore, nextDifficulty } from "@api-pokemon/shared";
import { openApiDocument, swaggerHtml } from "./openapi";

type Bindings = {
  ENVIRONMENT: string;
  WEB_ORIGIN?: string;
  DB?: D1Database;
};

type Game = GameState & {
  id: string;
  playerName: string;
  mode: "standard" | "streak";
  pokemon: PokemonFacts;
  choices: string[];
  hints: string[];
  startedAt: number;
  status: "active" | "finished";
};

const ROUND_TIME_LIMIT_SECONDS = 30;
const POKEAPI_TIMEOUT_MS = 2_500;
const pokemonPool = Array.from({ length: 151 }, (_, index) => index + 1);

const games = new Map<string, Game>();

export const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

app.onError((error, context) => {
  if (error instanceof ControlledServiceError) {
    return context.json({ error: error.publicMessage }, error.status);
  }
  return context.json({ error: "Internal server error" }, 500);
});

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
  const payload = await readJson<{ playerName?: string; mode?: "standard" | "streak" }>(context.req);
  const playerName = payload?.playerName?.trim();

  if (!playerName || playerName.length > 40) {
    return context.json({ error: "playerName is required and must be 40 characters or fewer" }, 400);
  }

  const pokemonId = randomPokemonId();
  const pokemon = await getPokemon(pokemonId);
  const choices = await buildChoices(pokemon);
  const game: Game = {
    id: crypto.randomUUID(),
    playerName,
    mode: payload?.mode === "streak" ? "streak" : "standard",
    pokemon,
    choices,
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
  if (answer && answer.length > 40) return context.json({ error: "answer is too long" }, 400);

  const elapsedSeconds = (Date.now() - game.startedAt) / 1000;
  const timedOut = elapsedSeconds >= ROUND_TIME_LIMIT_SECONDS;
  const correct = !timedOut && answer === game.pokemon.name.toLowerCase();
  const scoreBreakdown = calculateRoundScore({
    correct,
    elapsedSeconds,
    hintsUsed: game.hints.length,
    streak: game.streak,
  });
  const points = scoreBreakdown.totalPoints;
  const resolvedPokemon = game.pokemon;
  game.streak = correct ? game.streak + 1 : 0;
  game.score += points;
  game.difficulty = nextDifficulty(game.difficulty, correct, game.hints.length);
  const completed = game.mode === "streak" ? !correct : game.round >= 10;
  game.status = completed ? "finished" : "active";
  game.round += completed ? 0 : 1;
  if (!completed) {
    game.pokemon = await getPokemon(nextPokemonId(game.pokemon.id));
    game.choices = await buildChoices(game.pokemon);
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
    timedOut,
    scoreBreakdown,
    pokemon: { id: resolvedPokemon.id, name: resolvedPokemon.name, imageUrl: pokemonImageUrl(resolvedPokemon.id) },
    nextRound: completed ? null : { round: game.round, startedAt: game.startedAt, imageUrl: pokemonImageUrl(game.pokemon.id), choices: game.choices },
    choices: game.choices,
  });
});

app.get("/scores", async (context) => {
  const mode = context.req.query("mode") ?? "standard";
  if (mode !== "standard") {
    return context.json({ error: "Only the standard ranking is available" }, 400);
  }

  if (context.env.DB) {
    let result: D1Result<{ playerName: string; score: number; rounds: number }>;
    try {
      result = await context.env.DB.prepare(
        `SELECT scores.player_name AS playerName, scores.score, scores.rounds
         FROM scores
         INNER JOIN games ON games.id = scores.game_id
         WHERE games.mode = 'standard' AND games.status = 'finished' AND scores.rounds = 10
         ORDER BY scores.score DESC LIMIT 20`,
      ).all<{ playerName: string; score: number; rounds: number }>();
    } catch {
      throw new ControlledServiceError("Storage unavailable", 503);
    }
    return context.json({ scores: result.results });
  }

  const scores = [...games.values()]
    .filter((game) => game.mode === "standard" && game.status === "finished" && game.round === 10)
    .sort((left, right) => right.score - left.score)
    .slice(0, 20)
    .map((game) => ({ playerName: game.playerName, score: game.score, rounds: game.round }));

  return context.json({ scores });
});

function publicGame(game: Game) {
  return {
    id: game.id,
    playerName: game.playerName,
    mode: game.mode,
    difficulty: game.difficulty,
    round: game.round,
    score: game.score,
    streak: game.streak,
    status: game.status,
    hints: game.hints,
    choices: game.choices,
    imageUrl: pokemonImageUrl(game.pokemon.id),
    startedAt: game.startedAt,
  };
}

async function findGame(database: D1Database | undefined, id: string): Promise<Game | undefined> {
  const memoryGame = games.get(id);
  if (memoryGame || !database) return memoryGame;

  let row: DatabaseGame | null;
  try {
    row = await database.prepare("SELECT * FROM games WHERE id = ?1").bind(id).first<DatabaseGame>();
  } catch {
    throw new ControlledServiceError("Storage unavailable", 503);
  }
  if (!row) return undefined;

  let game: Game;
  try {
    game = {
      id: row.id,
      playerName: row.player_name,
      mode: row.mode as Game["mode"],
      pokemon: JSON.parse(row.pokemon_json) as PokemonFacts,
      hints: JSON.parse(row.hints_json) as string[],
      choices: JSON.parse(row.choices_json) as string[],
      difficulty: row.difficulty as Difficulty,
      round: row.round,
      score: row.score,
      streak: row.streak,
      startedAt: row.started_at,
      status: row.status as Game["status"],
    };
  } catch {
    throw new ControlledServiceError("Storage unavailable", 503);
  }
  games.set(id, game);
  return game;
}

async function saveGame(database: D1Database, game: Game, saveScore = false): Promise<void> {
  try {
    await database.prepare(
      `INSERT INTO games
        (id, status, difficulty, round_count, score, streak, player_name, pokemon_json,
        hints_json, started_at, round, created_at, finished_at, mode, choices_json)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status, difficulty = excluded.difficulty,
         round_count = excluded.round_count, score = excluded.score,
         streak = excluded.streak, hints_json = excluded.hints_json,
         round = excluded.round, finished_at = excluded.finished_at,
         mode = excluded.mode, choices_json = excluded.choices_json`,
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
      game.mode,
      JSON.stringify(game.choices),
    ).run();

    if (saveScore) {
      await database.prepare(
        "INSERT OR REPLACE INTO scores (id, game_id, player_name, score, rounds, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      ).bind(game.id, game.id, game.playerName, game.score, game.round, new Date().toISOString()).run();
    }
  } catch {
    throw new ControlledServiceError("Storage unavailable", 503);
  }
}

type DatabaseGame = {
  id: string;
  status: string;
  difficulty: string;
  score: number;
  streak: number;
  player_name: string;
  mode: string;
  pokemon_json: string;
  hints_json: string;
  choices_json: string;
  started_at: number;
  round: number;
};

function pokemonImageUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function nextPokemonId(currentId: number): number {
  const candidates = pokemonPool.filter((id) => id !== currentId);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function randomPokemonId(): number {
  return pokemonPool[Math.floor(Math.random() * pokemonPool.length)];
}

async function getPokemon(id: number): Promise<PokemonFacts> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), POKEAPI_TIMEOUT_MS);
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`, { signal: controller.signal });
    if (!response.ok) return fallbackPokemon(id);
    const data = await response.json() as unknown;
    return parsePokemonPayload(data) ?? fallbackPokemon(id);
  } catch {
    return fallbackPokemon(id);
  } finally {
    clearTimeout(timeout);
  }
}

function parsePokemonPayload(value: unknown): PokemonFacts | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  if (typeof data.id !== "number" || typeof data.name !== "string"
    || !Array.isArray(data.types) || !Array.isArray(data.abilities)
    || typeof data.height !== "number" || typeof data.weight !== "number"
    || typeof data.base_experience !== "number") return undefined;

  const types = data.types.map((entry) => (entry as { type?: { name?: unknown } }).type?.name);
  const abilities = data.abilities.map((entry) => (entry as { ability?: { name?: unknown } }).ability?.name);
  if (!types.every((type): type is string => typeof type === "string")
    || !abilities.every((ability): ability is string => typeof ability === "string")) return undefined;

  return {
    id: data.id,
    name: data.name,
    types,
    abilities,
    height: data.height,
    weight: data.weight,
    baseExperience: data.base_experience,
  };
}

function fallbackPokemon(id: number): PokemonFacts {
  const fallback = {
    1: { name: "bulbasaur", type: "grass", ability: "overgrow" },
    2: { name: "ivysaur", type: "grass", ability: "overgrow" },
  }[id as 1 | 2];
  if (!fallback) throw new ControlledServiceError("Pokemon data unavailable", 503);
  return { id, name: fallback.name, types: [fallback.type], abilities: [fallback.ability], height: 7, weight: 69, baseExperience: 64 };
}

class ControlledServiceError extends Error {
  constructor(public readonly publicMessage: string, public readonly status: 500 | 503) {
    super(publicMessage);
  }
}

async function buildChoices(correctPokemon: PokemonFacts): Promise<string[]> {
  const distractor = await getPokemon(nextPokemonId(correctPokemon.id));
  return Math.random() < 0.5
    ? [correctPokemon.name, distractor.name]
    : [distractor.name, correctPokemon.name];
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