import { FormEvent, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Game = {
  id: string;
  playerName: string;
  mode: "standard" | "streak";
  difficulty: "easy" | "normal" | "hard";
  round: number;
  score: number;
  streak: number;
  status: "active" | "finished";
  hints: string[];
  choices: string[];
  imageUrl: string;
  startedAt: number;
};

type Result = {
  correct: boolean;
  points: number;
  score: number;
  streak: number;
  difficulty: Game["difficulty"];
  round: number;
  finished: boolean;
  timedOut: boolean;
  scoreBreakdown: {
    basePoints: number;
    speedBonus: number;
    hintPenalty: number;
    streakMultiplier: number;
    totalPoints: number;
  };
  pokemon: { id: number; name: string; imageUrl: string };
  nextRound: {
    round: number;
    startedAt: number;
    imageUrl: string;
    choices: string[];
  } | null;
  choices: string[];
};

type Score = { playerName: string; score: number; rounds: number };
const apiUrl = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");
const ROUND_TIME_LIMIT_SECONDS = 30;

function App() {
  const [playerName, setPlayerName] = useState("");
  const [mode, setMode] = useState<"standard" | "streak">("standard");
  const [game, setGame] = useState<Game | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(ROUND_TIME_LIMIT_SECONDS);
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState(false);

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok)
      throw new Error(body.error ?? "No pudimos completar la solicitud.");
    return body;
  }

  async function startGame(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const created = await request<Game>("/games", {
        method: "POST",
        body: JSON.stringify({ playerName, mode }),
      });
      setGame(created);
      setResult(null);
      setAnswer("");
      setSecondsLeft(ROUND_TIME_LIMIT_SECONDS);
      setImageReady(false);
      setImageError(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Error al iniciar partida.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function askHint() {
    if (!game) return;
    setLoading(true);
    setError("");
    try {
      const response = await request<{ hint: string }>(
        `/games/${game.id}/hints`,
        { method: "POST" },
      );
      setGame({ ...game, hints: [...game.hints, response.hint] });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Error al solicitar pista.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitGuess(event: FormEvent) {
    event.preventDefault();
    await resolveGuess(answer);
  }

  async function resolveGuess(value: string) {
    if (!game || loading || result) return;
    setLoading(true);
    setError("");
    try {
      const response = await request<Result>(`/games/${game.id}/guess`, {
        method: "POST",
        body: JSON.stringify({ answer: value }),
      });
      setResult(response);
      setGame({
        ...game,
        status: response.finished ? "finished" : "active",
        round: response.nextRound?.round ?? response.round,
        score: response.score,
        streak: response.streak,
        difficulty: response.difficulty,
        hints: [],
        choices: response.nextRound?.choices ?? game.choices,
        imageUrl: response.nextRound?.imageUrl ?? game.imageUrl,
        startedAt: response.nextRound?.startedAt ?? game.startedAt,
      });
      if (response.nextRound) {
        setImageReady(false);
        setImageError(false);
      }
      const ranking = await request<{ scores: Score[] }>("/scores");
      setScores(ranking.scores);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Error al validar respuesta.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!game || result) return;
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - game.startedAt) / 1000);
      setSecondsLeft(Math.max(0, ROUND_TIME_LIMIT_SECONDS - elapsed));
    };
    updateTimer();
    const timer = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(timer);
  }, [game, result]);

  useEffect(() => {
    if (game && !result && secondsLeft === 0) void resolveGuess("");
  }, [secondsLeft, game, result]);

  function resetGame() {
    setGame(null);
    setResult(null);
    setAnswer("");
    setError("");
    setSecondsLeft(ROUND_TIME_LIMIT_SECONDS);
    setImageReady(false);
    setImageError(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand-mark"
          type="button"
          aria-label="Volver al inicio"
          title="Volver al inicio"
          onClick={resetGame}
        >
          PK
        </button>
        <div>
          <p className="eyebrow">Archivo de entrenadores</p>
          <h1>¿Quién es ese Pokemon?</h1>
        </div>
        <div className="status-pill">
          <span /> API en línea
        </div>
      </header>
      <main className="layout">
        <section className="hero-panel">
          <div className="section-label">
            <span>01</span> Identifica la silueta
          </div>
          {!game ? (
            <form className="start-form" onSubmit={startGame}>
              <h2>Tu próxima captura empieza aquí.</h2>
              <p>
                {mode === "standard"
                  ? "Entra en una partida de 10 rondas."
                  : "Mantén tu racha hasta el primer fallo."}{" "}
                Cada pista ayuda, pero reduce tu puntuación.
              </p>
              <label htmlFor="playerName">Nombre de entrenador</label>
              <div
                className="mode-selector"
                role="group"
                aria-label="Modo de juego"
              >
                <button
                  type="button"
                  className={mode === "standard" ? "selected" : ""}
                  onClick={() => setMode("standard")}
                >
                  10 rondas
                </button>
                <button
                  type="button"
                  className={mode === "streak" ? "selected" : ""}
                  onClick={() => setMode("streak")}
                >
                  Racha infinita
                </button>
              </div>
              <div className="input-row">
                <input
                  id="playerName"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  maxLength={40}
                  placeholder="Ej. Ash"
                  required
                />
                <button type="submit" disabled={loading}>
                  {loading ? "Cargando..." : "Comenzar"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div
                className={`pokemon-frame ${result ? "revealed" : ""} ${!result && !imageReady && !imageError ? "loading-image" : ""} ${!result && imageError ? "image-unavailable" : ""}`}
              >
                <div className="scan-line" />
                <img
                  key={result ? result.pokemon.imageUrl : game.imageUrl}
                  src={result ? result.pokemon.imageUrl : game.imageUrl}
                  onLoad={() => {
                    setImageReady(true);
                    setImageError(false);
                  }}
                  onError={() => {
                    setImageReady(true);
                    setImageError(true);
                  }}
                  alt={result ? result.pokemon.name : "Pokemon oculto"}
                />
                {!result && !imageReady && !imageError && (
                  <span className="image-loading">Cargando silueta...</span>
                )}
                {!result && imageError && (
                  <span className="image-error" role="status">
                    Imagen no disponible. Puedes responder igualmente.
                  </span>
                )}
                {!result && imageReady && !imageError && (
                  <span className="unknown">?</span>
                )}
              </div>
              <div className="round-meta">
                <span>
                  {game.mode === "streak"
                    ? `Racha ${game.round}`
                    : `Ronda ${game.round} / 10`}
                </span>
                <span className={`difficulty ${game.difficulty}`}>
                  {game.difficulty}
                </span>
              </div>
              {!result && (
                <div
                  className={`timer-panel ${secondsLeft <= 5 ? "urgent" : ""}`}
                  aria-live="polite"
                >
                  <span>Tiempo restante</span>
                  <strong>00:{String(secondsLeft).padStart(2, "0")}</strong>
                </div>
              )}
              {result ? (
                <div
                  className={`result ${result.correct ? "success" : result.timedOut ? "timeout" : "failure"}`}
                >
                  <div
                    className="result-feedback"
                    role="status"
                    aria-label={
                      result.correct
                        ? "Respuesta correcta"
                        : result.timedOut
                          ? "Tiempo agotado"
                          : "Respuesta incorrecta"
                    }
                  >
                    <span
                      className={`feedback-icon ${result.correct ? "check-icon" : result.timedOut ? "timeout-icon" : "failure-icon"}`}
                      aria-hidden="true"
                    />{" "}
                    <span>
                      {result.correct
                        ? "Acierto"
                        : result.timedOut
                          ? "Tiempo agotado"
                          : "Error"}
                    </span>
                  </div>
                  <p className="eyebrow">
                    {result.correct
                      ? "Acierto confirmado"
                      : result.timedOut
                        ? "Tiempo agotado"
                        : "Ronda resuelta"}
                  </p>
                  <h2>Era {result.pokemon.name}</h2>
                  <div className="score-breakdown">
                    <span>
                      Base <b>{result.scoreBreakdown.basePoints}</b>
                    </span>
                    <span>
                      Velocidad <b>+{result.scoreBreakdown.speedBonus}</b>
                    </span>
                    <span>
                      Pistas <b>-{result.scoreBreakdown.hintPenalty}</b>
                    </span>
                    <span>
                      Multiplicador{" "}
                      <b>
                        x{result.scoreBreakdown.streakMultiplier.toFixed(1)}
                      </b>
                    </span>
                    <strong>
                      Total ronda <b>{result.scoreBreakdown.totalPoints}</b>
                    </strong>
                  </div>
                  <p className="total-score">
                    Total partida: <b>{result.score}</b> pts
                  </p>
                  {result.finished ? (
                    <button type="button" onClick={resetGame}>
                      Nueva partida
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setAnswer("");
                        setSecondsLeft(ROUND_TIME_LIMIT_SECONDS);
                        setImageReady(false);
                        setImageError(false);
                      }}
                    >
                      Siguiente ronda
                    </button>
                  )}
                </div>
              ) : (
                <form className="guess-form" onSubmit={submitGuess}>
                  <label htmlFor="answer">¿Cuál es tu respuesta?</label>
                  <div className="choice-list">
                    {game.choices.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setAnswer(choice);
                          void resolveGuess(choice);
                        }}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                  <p className="choice-divider">o escribe tu respuesta</p>
                  <div className="input-row">
                    <input
                      id="answer"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      placeholder="Escribe el nombre..."
                      autoComplete="off"
                    />
                    <button type="submit" disabled={loading}>
                      {loading ? "..." : "Adivinar"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="side-panel">
          <section className="info-block">
            <div className="section-label">
              <span>02</span> Pistas
            </div>
            {game?.hints.length ? (
              <ol className="hint-list">
                {game.hints.map((hint, index) => (
                  <li key={`${hint}-${index}`}>{hint}</li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                Las pistas aparecerán aquí. Úsalas con estrategia.
              </p>
            )}
            {game && !result && (
              <button
                className="secondary-button"
                type="button"
                onClick={askHint}
                disabled={loading || game.hints.length >= 3}
              >
                {game.hints.length >= 3
                  ? "Sin pistas restantes"
                  : `Pedir pista ${game.hints.length + 1} / 3`}
              </button>
            )}
          </section>
          <section className="info-block score-block">
            <div className="section-label">
              <span>03</span> Marcador
            </div>
            <div className="score-value">
              {game?.score ?? 0}
              <small> pts</small>
            </div>
            <div className="score-detail">
              <span>Racha</span>
              <strong>{game?.streak ?? 0}</strong>
            </div>
          </section>
          <section className="info-block ranking-block">
            <div className="section-label">
              <span>04</span> Ranking
            </div>
            {scores.length ? (
              <ol>
                {scores.map((score, index) => (
                  <li key={`${score.playerName}-${index}`}>
                    <span>
                      <b>{index + 1}</b>
                      {score.playerName}
                    </span>
                    <strong>{score.score}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                El ranking se actualiza al resolver una ronda.
              </p>
            )}
          </section>
        </aside>
      </main>
      <footer>
        <span>POKÉDEX / 001</span>
        <span>Una partida limpia. Una mejor puntuación.</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
