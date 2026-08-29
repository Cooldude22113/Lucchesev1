import { useState, useEffect } from "react";

// Runtime configuration: which model answers by default, and the instructions
// Lucchese is given. Both live in the backend's settings table — the persona
// here overrides the default that ships in docs/character.md.

const API   = import.meta.env.VITE_API_URL || "https://api.lucchese.app";
const KEY   = import.meta.env.VITE_ADMIN_KEY;
const SERIF = "'Playfair Display', Georgia, serif";
const SANS  = "'DM Sans', system-ui, sans-serif";

const C = {
  bg: "#0a0a0a", surface: "#131313", surfaceLine: "#1f1f1f", composer: "#101010",
  composerLine: "#242424", gold: "#c8a96e", goldDim: "#8b6914", goldLine: "#2e2718",
  goldWash: "#12100c", head: "#e8e0d0", body: "#d5cdbe", muted: "#8b8578",
  dim: "#6f6759", faint: "#4a4438", green: "#4caf7d", red: "#e06c75",
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <label style={{
        display: "block", font: `500 12px ${SANS}`, letterSpacing: .8,
        textTransform: "uppercase", color: C.muted, marginBottom: 6,
      }}>{label}</label>
      {hint && (
        <p style={{ margin: "0 0 10px", font: `400 12.5px/1.6 ${SANS}`, color: C.faint }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [models,   setModels]   = useState([]);
  const [status,   setStatus]   = useState(null);   // saving | saved | error text
  const [error,    setError]    = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/settings`, { headers: { "X-Admin-Key": KEY } })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`settings: HTTP ${r.status}`)))),
      fetch(`${API}/models`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`models: HTTP ${r.status}`)))),
    ])
      .then(([s, m]) => {
        setSettings(s);
        setModels(Array.isArray(m?.models) ? m.models : []);
      })
      .catch(e => setError(e.message));
  }, []);

  const save = async () => {
    setStatus("saving");
    try {
      const res = await fetch(`${API}/settings`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Key": KEY },
        body:    JSON.stringify({
          default_model: settings.default_model || undefined,
          persona:       settings.persona,
          max_tokens:    Number(settings.max_tokens),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setSettings(data);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setStatus(`error: ${e.message}`);
    }
  };

  const field = { width: "100%", boxSizing: "border-box", background: C.composer,
                  border: `1px solid ${C.composerLine}`, borderRadius: 10,
                  padding: "11px 13px", color: C.body, font: `400 14px ${SANS}`,
                  outline: "none" };

  if (error) return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 40 }}>
      <p style={{ font: `400 14px ${SANS}`, color: C.red }}>
        Couldn't load settings — {error}. Is the backend running, and is
        VITE_ADMIN_KEY set?
      </p>
    </div>
  );

  if (!settings) return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 40 }}>
      <p style={{ font: `400 14px ${SANS}`, color: C.faint }}>Loading…</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ marginBottom: 34 }}>
          <a href="/chat" style={{
            font: `400 12px ${SANS}`, color: C.dim, letterSpacing: .6,
            textDecoration: "none",
          }}>← Back to chat</a>
          <h1 style={{
            margin: "14px 0 6px", font: `500 30px ${SERIF}`, color: C.head,
          }}>Settings</h1>
          <p style={{ margin: 0, font: `400 13.5px/1.6 ${SANS}`, color: C.faint }}>
            Applies to every new message, typed or spoken.
          </p>
        </header>

        <Field
          label="Default model"
          hint="Used when no model is picked in the chat composer, and for voice replies."
        >
          <select
            value={settings.default_model || ""}
            onChange={e => setSettings({ ...settings, default_model: e.target.value })}
            style={{ ...field, cursor: "pointer" }}
          >
            <option value="">First available model</option>
            {models.map(m => (
              <option key={m.id} value={m.id} disabled={!m.available}>
                {m.label}{m.available ? "" : ` — ${m.note}`}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Instructions"
          hint="Who Lucchese is and how it should behave. This is the system prompt — tell it to act like whatever character you want. The default came from docs/character.md."
        >
          <textarea
            value={settings.persona || ""}
            onChange={e => setSettings({ ...settings, persona: e.target.value })}
            rows={20}
            spellCheck={false}
            style={{ ...field, resize: "vertical", lineHeight: 1.65, minHeight: 240,
                     font: `400 13px ${SANS}` }}
          />
          <p style={{ margin: "8px 0 0", font: `400 11.5px ${SANS}`, color: C.faint }}>
            {(settings.persona || "").length.toLocaleString()} characters — sent with every message.
          </p>
        </Field>

        <Field
          label="Max reply length"
          hint="Token ceiling for one reply. Roughly 4 characters per token, so 4096 is about 3,000 words."
        >
          <input
            type="number" min={1} max={128000}
            value={settings.max_tokens}
            onChange={e => setSettings({ ...settings, max_tokens: e.target.value })}
            style={{ ...field, maxWidth: 180 }}
          />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 34 }}>
          <button
            onClick={save}
            disabled={status === "saving"}
            style={{
              padding: "11px 24px", borderRadius: 10, border: "none",
              background: `linear-gradient(135deg,${C.gold},${C.goldDim})`,
              color: C.bg, font: `500 13.5px ${SANS}`, letterSpacing: .3,
              cursor: status === "saving" ? "default" : "pointer",
              opacity: status === "saving" ? .6 : 1,
            }}
          >{status === "saving" ? "Saving…" : "Save settings"}</button>

          {status === "saved" && (
            <span style={{ font: `400 13px ${SANS}`, color: C.green }}>Saved.</span>
          )}
          {typeof status === "string" && status.startsWith("error") && (
            <span style={{ font: `400 13px ${SANS}`, color: C.red }}>
              {status.replace("error: ", "Couldn't save — ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
