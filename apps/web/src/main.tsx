import { FormEvent, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Game = {
  id: string;
  playerName: string;
  difficulty: "easy" | "normal" | "hard";
  round: number;
  score: number;
  streak: number;
  status: "active" | "finished";
  hints: string[];
  imageUrl: string;
};

type Result = {
  correct: boolean;
  points: number;
  score: number;
  streak: number;
  difficulty: Game["difficulty"];
  round: number;
  finished: boolean;
  pokemon: { id: number; name: string; imageUrl: string };
  nextRound: { round: number; imageUrl: string } | null;
};

type Score = { playerName: string; score: number; rounds: number };
const apiUrl = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

function App() {
  const [playerName, setPlayerName] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const body = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "No pudimos completar la solicitud.");
    return body;
  }

  async function startGame(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const created = await request<Game>("/games", { method: "POST", body: JSON.stringify({ playerName }) });
      setGame(created); setResult(null); setAnswer("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Error al iniciar partida."); }
    finally { setLoading(false); }
  }

  async function askHint() {
    if (!game) return; setLoading(true); setError("");
    try {
      const response = await request<{ hint: string }>(`/games/${game.id}/hints`, { method: "POST" });
      setGame({ ...game, hints: [...game.hints, response.hint] });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Error al solicitar pista."); }
    finally { setLoading(false); }
  }

  async function submitGuess(event: FormEvent) {
    event.preventDefault(); if (!game) return; setLoading(true); setError("");
    try {
      const response = await request<Result>(`/games/${game.id}/guess`, { method: "POST", body: JSON.stringify({ answer }) });
      setResult(response); setGame({ ...game, status: response.finished ? "finished" : "active", round: response.round, score: response.score, streak: response.streak, difficulty: response.difficulty, hints: [], imageUrl: response.nextRound?.imageUrl ?? game.imageUrl });
      const ranking = await request<{ scores: Score[] }>("/scores"); setScores(ranking.scores);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Error al validar respuesta."); }
    finally { setLoading(false); }
  }

  function resetGame() { setGame(null); setResult(null); setAnswer(""); setError(""); }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">PK</div>
        <div><p className="eyebrow">Archivo de entrenadores</p><h1>¿Quién es ese Pokemon?</h1></div>
        <div className="status-pill"><span /> API en línea</div>
      </header>
      <main className="layout">
        <section className="hero-panel">
          <div className="section-label"><span>01</span> Identifica la silueta</div>
          {!game ? <form className="start-form" onSubmit={startGame}>
            <h2>Tu próxima captura empieza aquí.</h2>
            <p>Entra en una partida de 10 rondas. Cada pista ayuda, pero reduce tu puntuación.</p>
            <label htmlFor="playerName">Nombre de entrenador</label>
            <div className="input-row"><input id="playerName" value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={40} placeholder="Ej. Ash" required /><button type="submit" disabled={loading}>{loading ? "Cargando..." : "Comenzar"}</button></div>
          </form> : <>
            <div className={`pokemon-frame ${result ? "revealed" : ""}`}><div className="scan-line" /><img src={result?.pokemon.imageUrl ?? game.imageUrl} alt={result ? result.pokemon.name : "Pokemon oculto"} />{!result && <span className="unknown">?</span>}</div>
            <div className="round-meta"><span>Ronda {game.round} / 10</span><span className={`difficulty ${game.difficulty}`}>{game.difficulty}</span></div>
            {result ? <div className={`result ${result.correct ? "success" : "failure"}`}><p className="eyebrow">{result.correct ? "Acierto confirmado" : "Ronda resuelta"}</p><h2>Era {result.pokemon.name}</h2><strong>{result.correct ? `+${result.points} puntos` : "0 puntos"}</strong>{result.finished ? <button type="button" onClick={resetGame}>Nueva partida</button> : <button type="button" onClick={() => { setResult(null); setAnswer(""); }}>Siguiente ronda</button>}</div> : <form className="guess-form" onSubmit={submitGuess}><label htmlFor="answer">¿Cuál es tu respuesta?</label><div className="input-row"><input id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Escribe el nombre..." autoComplete="off" required /><button type="submit" disabled={loading}>{loading ? "..." : "Adivinar"}</button></div></form>}
          </>}
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>
        <aside className="side-panel">
          <section className="info-block"><div className="section-label"><span>02</span> Pistas</div>{game?.hints.length ? <ol className="hint-list">{game.hints.map((hint, index) => <li key={`${hint}-${index}`}>{hint}</li>)}</ol> : <p className="muted">Las pistas aparecerán aquí. Úsalas con estrategia.</p>}{game && !result && <button className="secondary-button" type="button" onClick={askHint} disabled={loading || game.hints.length >= 3}>{game.hints.length >= 3 ? "Sin pistas restantes" : `Pedir pista ${game.hints.length + 1} / 3`}</button>}</section>
          <section className="info-block score-block"><div className="section-label"><span>03</span> Marcador</div><div className="score-value">{game?.score ?? 0}<small> pts</small></div><div className="score-detail"><span>Racha</span><strong>{game?.streak ?? 0}</strong></div></section>
          <section className="info-block ranking-block"><div className="section-label"><span>04</span> Ranking</div>{scores.length ? <ol>{scores.map((score, index) => <li key={`${score.playerName}-${index}`}><span><b>{index + 1}</b>{score.playerName}</span><strong>{score.score}</strong></li>)}</ol> : <p className="muted">El ranking se actualiza al resolver una ronda.</p>}</section>
        </aside>
      </main>
      <footer><span>POKÉDEX / 001</span><span>Una partida limpia. Una mejor puntuación.</span></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);