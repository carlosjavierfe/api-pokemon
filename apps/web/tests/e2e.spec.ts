import { test, expect, type Route } from "@playwright/test";

const game = {
  id: "game-browser-1",
  playerName: "Ash",
  mode: "standard",
  difficulty: "easy",
  round: 1,
  score: 0,
  streak: 0,
  status: "active",
  hints: [],
  choices: ["bulbasaur", "charmander"],
  imageUrl: "/mock-silhouette.png",
  startedAt: Date.now(),
};

async function mockApi(route: Route) {
  const url = new URL(route.request().url());
  if (url.pathname === "/api/games" && route.request().method() === "POST") {
    await route.fulfill({ json: game });
    return;
  }
  if (url.pathname === "/api/games/game-browser-1/hints") {
    await route.fulfill({ json: { hint: "Es de tipo planta.", hintsUsed: 1 } });
    return;
  }
  if (url.pathname === "/api/scores") {
    await route.fulfill({ json: { scores: [] } });
    return;
  }
  if (url.pathname === "/api/games/game-browser-1/guess") {
    await route.fulfill({
      json: {
        correct: true,
        points: 100,
        score: 100,
        streak: 1,
        difficulty: "easy",
        round: 1,
        finished: false,
        timedOut: false,
        scoreBreakdown: { basePoints: 100, speedBonus: 0, hintPenalty: 0, streakMultiplier: 1, totalPoints: 100 },
        pokemon: { id: 1, name: "bulbasaur", imageUrl: "/mock-bulbasaur.png" },
        nextRound: { round: 2, startedAt: Date.now(), imageUrl: "/mock-silhouette-2.png", choices: ["pikachu", "squirtle"] },
        choices: game.choices,
      },
    });
    return;
  }
  await route.continue();
}

async function mockImage(route: Route) {
  await route.fulfill({
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
}

test("inicia una partida standard y resuelve una ronda con dos opciones", async ({ page }) => {
  await page.route("**/api/**", mockApi);
  await page.route("**/mock-*.png", mockImage);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "¿Quién es ese Pokemon?" })).toBeVisible();
  await page.getByRole("button", { name: "10 rondas" }).click();
  await page.getByLabel("Nombre de entrenador").fill("Ash");
  await page.getByRole("button", { name: "Comenzar" }).click();

  await expect(page.getByText("Ronda 1 / 10")).toBeVisible();
  const choices = page.locator(".choice-list button");
  await expect(choices).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Pedir pista 1 / 3" })).toBeVisible();
  await page.getByRole("button", { name: "Pedir pista 1 / 3" }).click();
  await expect(page.getByText("Es de tipo planta.")).toBeVisible();
  await choices.first().click();
  await expect(page.getByRole("heading", { name: "Era bulbasaur" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Respuesta correcta" })).toBeVisible();
});