import { startTransition, useEffect, useState } from "react";

import { detectLanguage, getMessages, normalizeLanguage, t } from "./i18n";

const LEVEL_FALLBACKS = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
const MAX_MESSAGE_LENGTH = 2000;
const BLOCKED_PREFIXES = [
  "Ответ скрыт защитным фильтром",
  "Фильтр сработал",
  "Response hidden by safety filter",
];

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
  const normalized = text.trim();
  return BLOCKED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function statusTone({ loading, error, blocked, success }) {
  if (loading) return "status-pending";
  if (error) return "status-error";
  if (success) return "status-success";
  if (blocked) return "status-blocked";
  return "status-ready";
}

function localizeLevel(level, messages) {
  const key = String(level.id);
  return {
    ...level,
    title: t(messages, `levels.${key}.title`) || level.title || `Level ${level.id}`,
    badge: t(messages, `levels.${key}.badge`),
    description: t(messages, `levels.${key}.description`) || level.description || "",
  };
}

export default function App() {
  const [language, setLanguage] = useState(() => detectLanguage());
  const [levels, setLevels] = useState(LEVEL_FALLBACKS);
  const [levelsError, setLevelsError] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState(LEVEL_FALLBACKS[0].id);
  const [sessionId, setSessionId] = useState(() => createUuid7());
  const [message, setMessage] = useState("");
  const [hardMode, setHardMode] = useState(false);
  const [responseState, setResponseState] = useState({ type: "local", key: "response.intro" });
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [lastLatencyMs, setLastLatencyMs] = useState(null);
  const [lastStatusCode, setLastStatusCode] = useState(null);
  const [sessionRotated, setSessionRotated] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);

  const messages = getMessages(language);

  useEffect(() => {
    document.documentElement.lang = normalizeLanguage(language);
  }, [language]);

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
          setLevels(data.map((level) => ({ id: level.id, title: level.title, description: level.description })));
          setSelectedLevelId((current) => {
            if (data.some((level) => level.id === current)) {
              return current;
            }
            return data[0].id;
          });
          setLevelsError("");
        }
      } catch {
        if (!cancelled) {
          setLevelsError("levelsError");
        }
      }
    }

    loadLevels();
    return () => {
      cancelled = true;
    };
  }, []);

  const localizedLevels = levels.map((level) => localizeLevel(level, messages));
  const selectedLevel =
    localizedLevels.find((level) => level.id === selectedLevelId) ?? localizedLevels[0];
  const responseText =
    responseState.type === "backend" ? responseState.text : t(messages, responseState.key);
  const blocked = looksBlocked(responseText);
  const toneClassName = statusTone({ loading, error: apiError, blocked, success });
  const confettiPieces = buildConfettiPieces(confettiSeed);

  function resetSessionForLevel(levelId) {
    setSelectedLevelId(levelId);
    setSessionId(createUuid7());
    setMessage("");
    setResponseState({ type: "local", key: "response.newSession" });
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
        setResponseState({ type: "backend", text: payload.response_text });
        setSessionRotated(Boolean(payload.session_rotated));
        setSessionId(payload.session_id);
        setSuccess(Boolean(payload.success));
        setMessage("");
        if (payload.success) {
          setConfettiSeed((current) => current + 1);
        }
      });
    } catch (error) {
      setApiError(error instanceof Error ? error.message : t(messages, "status.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopySession() {
    try {
      await navigator.clipboard.writeText(sessionId);
    } catch {
      setApiError(t(messages, "session.copyError"));
    }
  }

  return (
    <div className="app-shell">
      <div className="page-noise" aria-hidden="true" />

      <div className="language-switcher" aria-label={t(messages, "language.label")}>
        <button
          type="button"
          className={`language-button ${language === "ru" ? "is-active" : ""}`}
          onClick={() => setLanguage("ru")}
        >
          {t(messages, "language.ru")}
        </button>
        <button
          type="button"
          className={`language-button ${language === "en" ? "is-active" : ""}`}
          onClick={() => setLanguage("en")}
        >
          {t(messages, "language.en")}
        </button>
      </div>

      <header className="hero">
        <div className="hero-mark">
          <div className="beaker-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="hero-kicker">{t(messages, "hero.kicker")}</p>
            <h1>{t(messages, "hero.title")}</h1>
          </div>
        </div>
        <aside className="hero-note">
          <p className="hero-note-label">{t(messages, "hero.noteLabel")}</p>
          <p>{t(messages, "hero.noteBody")}</p>
        </aside>
      </header>

      <main className="layout">
        <section className="panel panel-left">
          <div className="panel-header">
            <h2>{t(messages, "panel.levelsTitle")}</h2>
            <span className="panel-tag">{t(messages, "panel.levelsTag")}</span>
          </div>

          <div className="level-grid">
            {localizedLevels.map((level) => {
              const active = level.id === selectedLevelId;
              return (
                <button
                  key={level.id}
                  type="button"
                  className={`level-card ${active ? "is-active" : ""}`}
                  onClick={() => resetSessionForLevel(level.id)}
                >
                  <span className="level-number">{level.id}</span>
                  <span className="level-name">{level.badge}</span>
                  <span className="level-description">{level.description}</span>
                </button>
              );
            })}
          </div>

          <div className="session-box">
            <div>
              <p className="eyebrow">{t(messages, "session.eyebrow")}</p>
              <p className="session-value">{sessionId}</p>
            </div>
            <button type="button" className="ghost-button" onClick={handleCopySession}>
              {t(messages, "session.copy")}
            </button>
          </div>

          <div className="toggle-row">
            <div>
              <p className="eyebrow danger">{t(messages, "controls.hardModeTitle")}</p>
              <p className="toggle-copy">{t(messages, "controls.hardModeBody")}</p>
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
            <p className="eyebrow accent">{t(messages, "controls.currentLevel")}</p>
            <h3>
              {selectedLevel.title} · {selectedLevel.badge}
            </h3>
            <p>{selectedLevel.description}</p>
            {levelsError ? <p className="helper-warning">{t(messages, "controls.levelsError")}</p> : null}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <label className="composer-label" htmlFor="message">
              {t(messages, "controls.composerLabel")}
            </label>
            <textarea
              id="message"
              value={message}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={t(messages, "controls.composerPlaceholder")}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="composer-footer">
              <p className="message-limit">
                {message.length} / {MAX_MESSAGE_LENGTH}
              </p>
              <button type="submit" className="primary-button" disabled={loading || !message.trim()}>
                {loading ? t(messages, "controls.sending") : t(messages, "controls.send")}
              </button>
            </div>
          </form>
        </section>

        <section className={`panel panel-right ${toneClassName}`}>
          <div className="panel-header">
            <h2>{t(messages, "panel.responseTitle")}</h2>
            <span className="panel-tag live-tag">{loading ? t(messages, "panel.live") : t(messages, "panel.ready")}</span>
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
              <p className="eyebrow">{t(messages, "status.filterTitle")}</p>
              <strong>
                {blocked
                  ? t(messages, "status.filterTriggered")
                  : selectedLevelId > 1
                    ? t(messages, "status.filterActive")
                    : t(messages, "status.filterOff")}
              </strong>
              <p>
                {blocked
                  ? t(messages, "status.filterTriggeredBody")
                  : selectedLevelId > 1
                    ? t(messages, "status.filterActiveBody")
                    : t(messages, "status.filterOffBody")}
              </p>
            </article>

            <article className={`status-card ${success ? "is-success" : ""}`}>
              <p className="eyebrow">{t(messages, "status.missionTitle")}</p>
              <strong>{success ? t(messages, "status.missionSuccess") : t(messages, "status.missionActive")}</strong>
              <p>
                {success
                  ? t(messages, "status.missionSuccessBody")
                  : t(messages, "status.missionActiveBody")}
              </p>
            </article>
          </div>

          <div className="status-strip">
            <div>
              <p className="eyebrow">{t(messages, "status.apiTitle")}</p>
              <strong>
                {apiError
                  ? t(messages, "status.apiError")
                  : loading
                    ? t(messages, "status.apiLoading")
                    : t(messages, "status.apiReady")}
              </strong>
            </div>
            <div>
              <p className="eyebrow">{t(messages, "status.httpTitle")}</p>
              <strong>{lastStatusCode ?? "—"}</strong>
            </div>
            <div>
              <p className="eyebrow">{t(messages, "status.latencyTitle")}</p>
              <strong>{lastLatencyMs ? `${lastLatencyMs} ms` : "—"}</strong>
            </div>
            <div>
              <p className="eyebrow">{t(messages, "status.rotationTitle")}</p>
              <strong>{sessionRotated ? t(messages, "status.rotationNew") : t(messages, "status.rotationStable")}</strong>
            </div>
          </div>

          <div className="transcript">
            <div className="transcript-card">
              <p className="eyebrow">{t(messages, "status.lastPrompt")}</p>
              <p>{lastUserMessage || t(messages, "status.lastPromptEmpty")}</p>
            </div>
            <div className="transcript-card">
              <p className="eyebrow">{t(messages, "status.systemTitle")}</p>
              <p>
                {apiError
                  ? apiError
                  : sessionRotated
                    ? t(messages, "session.rotated")
                    : t(messages, "session.stable")}
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
