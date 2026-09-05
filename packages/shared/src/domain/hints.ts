import type { HintLevel, PokemonFacts } from "../index";

const MAX_HINTS = 3;

export function buildHint(pokemon: PokemonFacts, level: HintLevel): string {
  if (level < 1 || level > MAX_HINTS) {
    throw new Error("Hint level must be between 1 and 3");
  }

  const hint = [
    `Su tipo incluye ${pokemon.types[0] ?? "un tipo desconocido"}.`,
    `Una de sus habilidades es ${pokemon.abilities[0] ?? "poco comun"}.`,
    `Su altura es de ${pokemon.height / 10} metros y su peso es de ${pokemon.weight / 10} kilogramos.`,
  ][level - 1];

  return isSafeHint(hint, pokemon) ? hint : "Tiene caracteristicas unicas.";
}

export function isSafeHint(hint: string, pokemon: PokemonFacts): boolean {
  const normalizedHint = normalize(pokemon.name);
  const normalizedSlug = normalize(pokemon.name.replaceAll(" ", "-"));
  const normalizedCandidate = normalize(hint);

  return !normalizedCandidate.includes(normalizedHint) && !normalizedCandidate.includes(normalizedSlug);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}