export type Difficulty = "easy" | "normal" | "hard";

export type HealthResponse = {
  status: "ok";
  environment: string;
};

export type PokemonFacts = {
  id: number;
  name: string;
  types: string[];
  abilities: string[];
  height: number;
  weight: number;
  baseExperience: number;
};

export type HintLevel = 1 | 2 | 3;

export type GameState = {
  difficulty: Difficulty;
  round: number;
  score: number;
  streak: number;
};

export type GuessResult = {
  correct: boolean;
  points: number;
  nextDifficulty: Difficulty;
  nextStreak: number;
};

export { buildHint, isSafeHint } from "./domain/hints";
export { calculateRoundPoints, nextDifficulty } from "./domain/scoring";