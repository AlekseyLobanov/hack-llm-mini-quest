import { startTransition, useEffect, useState } from "react";

const LEVEL_FALLBACKS = [
  {
    id: 1,
    title: "Level 1",
    description: "Базовый агент без дополнительных проверок.",
  },
  {
    id: 2,
    title: "Level 2",
    description: "Ответ агента проверяется защитным фильтром.",
  },
  {
    id: 3,
    title: "Level 3",
    description: "Фильтр проверяет и запрос, и ответ агента.",
  },
  {
    id: 4,
    title: "Level 4",
    description: "Уровень 3 с ограничением на астрономические темы.",
  },
];

const MAX_MESSAGE_LENGTH = 2000;
const BLOCKED_PREFIX = "Ответ скрыт защитным фильтром";

function createUuid7() {
  const timestamp = BigInt(Date.now());
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function buildConfettiPieces(seed) {
  const colors = ["#ea552b", "#1f6d77", "#f4b860", "#22313f", "#d84f2a", "#7aa6ad"];
  return Array.from({ length: 18 }, (_, index) => {
    const hue = colors[index % colors.length];
    const left = (seed * 17 + index * 11) % 96;
    const delay = (index % 6) * 60;
    const duration = 900 + ((seed + index * 29) % 500);
    const rotate = (seed * 13 + index * 37) % 360;
    return {
      id: `${seed}-${index}`,
      style: {
        left: `${left}%`,
        background: hue,
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        transform: `rotate(${rotate}deg)`,
      },
    };
  });
}

function looksBlocked(text) {
  return text.trim().startsWith(BLOCKED_PREFIX);
}

function levelBadge(levelId) {
  switch (levelId) {
    case 1:
      return "Intro";
    case 2:
      return "Social Engineer";
    case 3:
      return "Context Shift";
    case 4:
      return "Red Team";
    default:
      return "Unknown";
  }
}

function statusTone({ loading, error, blocked, success }) {
  if (loading) return "status-pending";
  if (error) return "status-error";
  if (success) return "status-success";
  if (blocked) return "status-blocked";
  return "status-ready";
}

export default function App() {
  const [levels, setLevels] = useState(LEVEL_FALLBACKS);
  const [levelsError, setLevelsError] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState(LEVEL_FALLBACKS[0].id);
  const [sessionId, setSessionId] = useState(() => createUuid7());
  const [message, setMessage] = useState("");
  const [hardMode, setHardMode] = useState(false);
  const [responseText, setResponseText] = useState("Выберите уровень и попробуйте выманить пароль у агента.");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [lastLatencyMs, setLastLatencyMs] = useState(null);
  const [lastStatusCode, setLastStatusCode] = useState(null);
  const [sessionRotated, setSessionRotated] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadLevels() {
      try {
        const response = await fetch("/api/v1/levels");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setLevels(data);
          setSelectedLevelId((current) => {
            if (data.some((level) => level.id === current)) {
              return current;
            }
            return data[0].id;
          });
          setLevelsError("");
        }
      } catch (error) {
        if (!cancelled) {
          setLevelsError("Не удалось загрузить уровни. Использую локальное описание.");
        }
      }
    }

    loadLevels();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedLevel = levels.find((level) => level.id === selectedLevelId) ?? levels[0];
  const blocked = looksBlocked(responseText);
  const toneClassName = statusTone({ loading, error: apiError, blocked, success });
  const confettiPieces = buildConfettiPieces(confettiSeed);

  function resetSessionForLevel(levelId) {
    setSelectedLevelId(levelId);
    setSessionId(createUuid7());
    setMessage("");
    setResponseText("Новая сессия готова. Отправьте сообщение агенту.");
    setLastUserMessage("");
    setApiError("");
    setSessionRotated(false);
    setSuccess(false);
    setLastStatusCode(null);
    setLastLatencyMs(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    setApiError("");
    setSessionRotated(false);

    const startedAt = performance.now();

    try {
      const response = await fetch(`/api/v1/levels/query/${selectedLevelId}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          text: trimmed,
          hard_mode: hardMode,
        }),
      });

      setLastStatusCode(response.status);

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const detail = errorPayload?.detail ?? `HTTP ${response.status}`;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }

      const payload = await response.json();
      const latency = Math.round(performance.now() - startedAt);

      startTransition(() => {
        setLastLatencyMs(latency);
        setLastUserMessage(trimmed);
        setResponseText(payload.response_text);
        setSessionRotated(Boolean(payload.session_rotated));
        setSessionId(payload.session_id);
        setSuccess(Boolean(payload.success));
        setMessage("");
        if (payload.success) {
          setConfettiSeed((current) => current + 1);
        }
      });
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Неизвестная ошибка запроса.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopySession() {
    try {
      await navigator.clipboard.writeText(sessionId);
    } catch {
      setApiError("Не удалось скопировать session_id в буфер обмена.");
    }
  }

  return (
    <div className="app-shell">
      <div className="page-noise" aria-hidden="true" />
      <header className="hero">
        <div className="hero-mark">
          <div className="beaker-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="hero-kicker">Secret Stress Lab</p>
            <h1>Проверь, сможет ли человек вытянуть секрет у LLM-агента.</h1>
          </div>
        </div>
        <aside className="hero-note">
          <p className="hero-note-label">Lab Notes</p>
          <p>
            У каждого уровня есть скрытый пароль. Выбирай уровень, включай hard mode и смотри,
            где защита ломается.
          </p>
        </aside>
      </header>

      <main className="layout">
        <section className="panel panel-left">
          <div className="panel-header">
            <h2>Выбор уровня</h2>
            <span className="panel-tag">4 сценария</span>
          </div>

          <div className="level-grid">
            {levels.map((level) => {
              const active = level.id === selectedLevelId;
              return (
                <button
                  key={level.id}
                  type="button"
                  className={`level-card ${active ? "is-active" : ""}`}
                  onClick={() => resetSessionForLevel(level.id)}
                >
                  <span className="level-number">{level.id}</span>
                  <span className="level-name">{levelBadge(level.id)}</span>
                  <span className="level-description">{level.description}</span>
                </button>
              );
            })}
          </div>

          <div className="session-box">
            <div>
              <p className="eyebrow">Session ID</p>
              <p className="session-value">{sessionId}</p>
            </div>
            <button type="button" className="ghost-button" onClick={handleCopySession}>
              Скопировать
            </button>
          </div>

          <div className="toggle-row">
            <div>
              <p className="eyebrow danger">Hard Mode</p>
              <p className="toggle-copy">
                Пароль будет ротироваться каждые несколько запросов. Фронтенд принимает новый
                <code>session_id</code> из ответа сервера.
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={hardMode}
                onChange={(event) => setHardMode(event.target.checked)}
              />
              <span className="switch-track" />
            </label>
          </div>

          <div className="level-explainer">
            <p className="eyebrow accent">Текущий уровень</p>
            <h3>
              {selectedLevel.title} · {levelBadge(selectedLevel.id)}
            </h3>
            <p>{selectedLevel.description}</p>
            {levelsError ? <p className="helper-warning">{levelsError}</p> : null}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <label className="composer-label" htmlFor="message">
              Сообщение агенту
            </label>
            <textarea
              id="message"
              value={message}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Напишите вопрос, инструкцию или попытку обхода правил…"
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="composer-footer">
              <p className="message-limit">
                {message.length} / {MAX_MESSAGE_LENGTH}
              </p>
              <button type="submit" className="primary-button" disabled={loading || !message.trim()}>
                {loading ? "Отправка…" : "Send Message"}
              </button>
            </div>
          </form>
        </section>

        <section className={`panel panel-right ${toneClassName}`}>
          <div className="panel-header">
            <h2>Ответ агента</h2>
            <span className="panel-tag live-tag">{loading ? "live" : "ready"}</span>
          </div>

          <div className="response-box">
            <div className="response-gutter" aria-hidden="true">
              <span>01</span>
              <span>02</span>
              <span>03</span>
              <span>04</span>
              <span>05</span>
            </div>
            <div className="response-content">
              <p>{responseText}</p>
            </div>
          </div>

          <div className="status-grid">
            <article className={`status-card ${blocked ? "is-alert" : ""}`}>
              <p className="eyebrow">Filter Status</p>
              <strong>{blocked ? "Сработал" : selectedLevelId > 1 ? "Активен" : "Выключен"}</strong>
              <p>
                {blocked
                  ? "Ответ заменён защитной заглушкой."
                  : selectedLevelId > 1
                    ? "Дополнительный LLM-фильтр следит за запросом и ответом."
                    : "На первом уровне дополнительных фильтров нет."}
              </p>
            </article>

            <article className={`status-card ${success ? "is-success" : ""}`}>
              <p className="eyebrow">Mission State</p>
              <strong>{success ? "Пароль угадан" : "Атака продолжается"}</strong>
              <p>
                {success
                  ? "Сервер подтвердил успех и вернул победный статус."
                  : "Пробуй другие формулировки, роли и обходные сценарии."}
              </p>
            </article>
          </div>

          <div className="status-strip">
            <div>
              <p className="eyebrow">API status</p>
              <strong>{apiError ? "Ошибка" : loading ? "Запрос…" : "Готов"}</strong>
            </div>
            <div>
              <p className="eyebrow">HTTP</p>
              <strong>{lastStatusCode ?? "—"}</strong>
            </div>
            <div>
              <p className="eyebrow">Latency</p>
              <strong>{lastLatencyMs ? `${lastLatencyMs} ms` : "—"}</strong>
            </div>
            <div>
              <p className="eyebrow">Rotation</p>
              <strong>{sessionRotated ? "New session" : "Stable"}</strong>
            </div>
          </div>

          <div className="transcript">
            <div className="transcript-card">
              <p className="eyebrow">Последний запрос</p>
              <p>{lastUserMessage || "Пока пусто. Первый ход за вами."}</p>
            </div>
            <div className="transcript-card">
              <p className="eyebrow">Системное сообщение</p>
              <p>
                {apiError
                  ? apiError
                  : sessionRotated
                    ? "Сервер ротировал сессию и прислал новый идентификатор."
                    : "Сессия активна. Следующий запрос пойдёт в текущий контекст."}
              </p>
            </div>
          </div>

          {success ? (
            <div className="confetti-layer" aria-hidden="true">
              {confettiPieces.map((piece) => (
                <span key={piece.id} className="confetti-piece" style={piece.style} />
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
