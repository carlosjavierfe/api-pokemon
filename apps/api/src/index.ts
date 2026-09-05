import { Hono } from "hono";
import type { Difficulty, GameState, PokemonFacts } from "@api-pokemon/shared";
import { buildHint, calculateRoundPoints, nextDifficulty } from "@api-pokemon/shared";

type Bindings = {
  ENVIRONMENT: string;
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

app.get("/health", (context) => {
  return context.json({ status: "ok", environment: context.env.ENVIRONMENT });
});

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
  return context.json(publicGame(game), 201);
});

app.get("/games/:id", (context) => {
  const game = games.get(context.req.param("id"));
  return game ? context.json(publicGame(game)) : context.json({ error: "Game not found" }, 404);
});

app.post("/games/:id/hints", (context) => {
  const game = games.get(context.req.param("id"));
  if (!game) return context.json({ error: "Game not found" }, 404);
  if (game.status !== "active") return context.json({ error: "Game is finished" }, 409);
  if (game.hints.length >= 3) return context.json({ error: "Maximum hints reached" }, 409);

  const hint = buildHint(game.pokemon, (game.hints.length + 1) as 1 | 2 | 3);
  game.hints.push(hint);
  return context.json({ hint, hintsUsed: game.hints.length });
});

app.post("/games/:id/guess", async (context) => {
  const game = games.get(context.req.param("id"));
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
  game.streak = correct ? game.streak + 1 : 0;
  game.score += points;
  game.difficulty = nextDifficulty(game.difficulty, correct, game.hints.length);
  game.status = "finished";

  return context.json({
    correct,
    points,
    score: game.score,
    streak: game.streak,
    difficulty: game.difficulty,
    pokemon: { id: game.pokemon.id, name: game.pokemon.name, imageUrl: pokemonImageUrl(game.pokemon.id) },
  });
});

app.get("/scores", (context) => {
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

function pokemonImageUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
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

export default app;