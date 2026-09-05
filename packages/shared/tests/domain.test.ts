import { describe, expect, it } from "vitest";
import { buildHint, calculateRoundPoints, isSafeHint, nextDifficulty } from "../src";
import type { PokemonFacts } from "../src";

const pokemon: PokemonFacts = {
  id: 25,
  name: "pikachu",
  types: ["electrico"],
  abilities: ["static"],
  height: 4,
  weight: 60,
  baseExperience: 112,
};

describe("hint domain", () => {
  it("builds three progressive safe hints", () => {
    expect(buildHint(pokemon, 1)).toContain("electrico");
    expect(buildHint(pokemon, 2)).toContain("static");
    expect(buildHint(pokemon, 3)).toContain("0.4 metros");
    expect(buildHint(pokemon, 1).toLowerCase()).not.toContain("pikachu");
  });

  it("rejects the Pokemon name or slug in a hint", () => {
    expect(isSafeHint("Este Pokemon es Pikachu", pokemon)).toBe(false);
    expect(isSafeHint("Su tipo incluye electrico", pokemon)).toBe(true);
  });

  it("rejects invalid hint levels", () => {
    expect(() => buildHint(pokemon, 4 as 1 | 2 | 3)).toThrow();
  });
});

describe("scoring domain", () => {
  it("awards points for a fast correct answer", () => {
    expect(calculateRoundPoints({ correct: true, elapsedSeconds: 4, hintsUsed: 0, streak: 0 })).toBe(128);
  });

  it("never awards points for a wrong answer", () => {
    expect(calculateRoundPoints({ correct: false, elapsedSeconds: 1, hintsUsed: 0, streak: 5 })).toBe(0);
  });

  it("adapts difficulty within its boundaries", () => {
    expect(nextDifficulty("easy", false, 0)).toBe("easy");
    expect(nextDifficulty("normal", true, 0)).toBe("hard");
    expect(nextDifficulty("hard", true, 2)).toBe("hard");
    expect(nextDifficulty("normal", false, 0)).toBe("easy");
  });
});