import type { Difficulty } from "../index";

const BASE_POINTS = 100;
const HINT_PENALTY = 15;
const MAX_POINTS = 150;

export function calculateRoundPoints(input: {
  correct: boolean;
  elapsedSeconds: number;
  hintsUsed: number;
  streak: number;
}): number {
  if (!input.correct) {
    return 0;
  }

  const speedBonus = Math.max(0, 30 - Math.floor(Math.max(0, input.elapsedSeconds) / 2));
  const hintPenalty = Math.min(3, Math.max(0, input.hintsUsed)) * HINT_PENALTY;
  const streakMultiplier = Math.min(2, 1 + Math.max(0, input.streak) * 0.1);
  const rawPoints = (BASE_POINTS + speedBonus - hintPenalty) * streakMultiplier;

  return Math.max(0, Math.min(MAX_POINTS, Math.round(rawPoints)));
}

export function nextDifficulty(current: Difficulty, correct: boolean, hintsUsed: number): Difficulty {
  const levels: Difficulty[] = ["easy", "normal", "hard"];
  const currentIndex = levels.indexOf(current);
  const delta = correct && hintsUsed <= 1 ? 1 : correct ? 0 : -1;
  const nextIndex = Math.min(levels.length - 1, Math.max(0, currentIndex + delta));

  return levels[nextIndex];
}