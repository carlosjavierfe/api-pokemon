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
        scoreBreakdown: {
          basePoints: 100,
          speedBonus: 0,
          hintPenalty: 0,
          streakMultiplier: 1,
          totalPoints: 100,
        },
        pokemon: { id: 1, name: "bulbasaur", imageUrl: "/mock-bulbasaur.png" },
        nextRound: {
          round: 2,
          startedAt: Date.now(),
          imageUrl: "/mock-silhouette-2.png",
          choices: ["pikachu", "squirtle"],
        },
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
    body: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
}

test("inicia una partida standard y resuelve una ronda con dos opciones", async ({
  page,
}) => {
  await page.route("**/api/**", mockApi);
  await page.route("**/mock-*.png", mockImage);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "¿Quién es ese Pokemon?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "10 rondas" }).click();
  await page.getByLabel("Nombre de entrenador").fill("Ash");
  await page.getByRole("button", { name: "Comenzar" }).click();

  await expect(page.getByText("Ronda 1 / 10")).toBeVisible();
  const choices = page.locator(".choice-list button");
  await expect(choices).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Pedir pista 1 / 3" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pedir pista 1 / 3" }).click();
  await expect(page.getByText("Es de tipo planta.")).toBeVisible();
  await choices.first().click();
  await expect(
    page.getByRole("heading", { name: "Era bulbasaur" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Respuesta correcta" }),
  ).toBeVisible();
});

test("vuelve al formulario de nueva partida desde PK", async ({ page }) => {
  await page.route("**/api/**", mockApi);
  await page.route("**/mock-*.png", mockImage);
  await page.goto("/");

  await page.getByLabel("Nombre de entrenador").fill("Ash");
  await page.getByRole("button", { name: "Comenzar" }).click();
  await expect(page.getByText("Ronda 1 / 10")).toBeVisible();

  await page.getByRole("button", { name: "Volver al inicio" }).click();

  await expect(
    page.getByRole("heading", { name: "Tu próxima captura empieza aquí." }),
  ).toBeVisible();
});

test("prepara la segunda ronda y permite responder aunque su imagen tarde", async ({
  page,
}) => {
  let releaseSecondImage!: () => void;
  const secondImageReady = new Promise<void>((resolve) => {
    releaseSecondImage = resolve;
  });

  await page.route("**/api/**", mockApi);
  await page.route("**/mock-*.png", mockImage);
  await page.route("**/mock-silhouette-2.png", async (route) => {
    await secondImageReady;
    await route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await page.goto("/");

  await page.getByLabel("Nombre de entrenador").fill("Ash");
  await page.getByRole("button", { name: "Comenzar" }).click();
  await expect(page.locator(".choice-list button").first()).toBeEnabled();
  await page.locator(".choice-list button").first().click();
  await page.getByRole("button", { name: "Siguiente ronda" }).click();

  await expect(page.getByText("Ronda 2 / 10")).toBeVisible();
  await expect(page.locator('img[alt="Pokemon oculto"]')).toHaveAttribute(
    "src",
    "/mock-silhouette-2.png",
  );
  await expect(page.locator(".choice-list button")).toHaveCount(2);
  await expect(page.locator(".choice-list button").first()).toBeEnabled();
  await expect(page.getByRole("button", { name: "Adivinar" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "pikachu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "squirtle" })).toBeVisible();
  await page.getByRole("button", { name: "pikachu" }).click();
  await expect(
    page.getByRole("heading", { name: "Era bulbasaur" }),
  ).toBeVisible();
  releaseSecondImage();
});

test("permite responder si la imagen de la segunda ronda falla", async ({
  page,
}) => {
  await page.route("**/api/**", mockApi);
  await page.route("**/mock-silhouette.png", mockImage);
  await page.route("**/mock-silhouette-2.png", (route) => route.abort());
  await page.goto("/");

  await page.getByLabel("Nombre de entrenador").fill("Ash");
  await page.getByRole("button", { name: "Comenzar" }).click();
  await page.locator(".choice-list button").first().click();
  await page.getByRole("button", { name: "Siguiente ronda" }).click();

  await expect(
    page.getByText("Imagen no disponible. Puedes responder igualmente."),
  ).toBeVisible();
  await expect(page.locator(".choice-list button").first()).toBeEnabled();
  await page.locator(".choice-list button").first().click();
  await expect(
    page.getByRole("heading", { name: "Era bulbasaur" }),
  ).toBeVisible();
});

test("mantiene accesibles el inicio y el resultado sin overflow horizontal", async ({
  page,
}) => {
  await page.route("**/api/**", mockApi);
  await page.route("**/mock-*.png", mockImage);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Tu próxima captura empieza aquí." }),
  ).toBeVisible();
  await expect(
    page.getByText("o escribe tu respuesta", { exact: true }),
  ).toBeHidden();
  await page.getByLabel("Nombre de entrenador").fill("Ash");
  await page.getByRole("button", { name: "Comenzar" }).click();
  await expect(page.getByText("Ronda 1 / 10")).toBeVisible();

  const hasNoHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
        document.documentElement.clientWidth &&
      document.body.scrollWidth <= document.body.clientWidth,
  );
  expect(hasNoHorizontalOverflow).toBe(true);

  await page.locator(".choice-list button").first().click();
  const resultHeading = page.getByRole("heading", { name: "Era bulbasaur" });
  await expect(resultHeading).toBeVisible();
  await resultHeading.scrollIntoViewIfNeeded();
  await expect(resultHeading).toBeInViewport();
  const resultHasNoHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
        document.documentElement.clientWidth &&
      document.body.scrollWidth <= document.body.clientWidth,
  );
  expect(resultHasNoHorizontalOverflow).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByText("Ronda 2 / 10")).toBeVisible();
});
