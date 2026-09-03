import { useState, useEffect } from "react";

// The owner page — Alex's alone. Everything here is served by /owner/* which
// only answers requests from the machine running the backend, so opening
// lucchese.app through the tunnel gets a refusal rather than this page.
//
// The timeline is editable data, not a generated report: it is where the
// project's history and what's next actually live.

const API   = import.meta.env.VITE_API_URL || "https://api.lucchese.app";
const SERIF = "'Playfair Display', Georgia, serif";
const SANS  = "'DM Sans', system-ui, sans-serif";
const MONO  = "ui-monospace, Consolas, monospace";

const C = {
  bg: "#0a0a0a", surface: "#131313", surfaceLine: "#1f1f1f", composer: "#101010",
  composerLine: "#242424", gold: "#c8a96e", goldDim: "#8b6914", goldLine: "#2e2718",
  goldWash: "#12100c", head: "#e8e0d0", body: "#d5cdbe", muted: "#8b8578",
  dim: "#6f6759", faint: "#4a4438", ghost: "#3a3a3a", green: "#4caf7d", red: "#e06c75",
  blue: "#7cb8e8",
};

const STATUS = {
  done: { label: "Done",    colour: C.green, dot: C.green },
  now:  { label: "Now",     colour: C.gold,  dot: C.gold  },
  next: { label: "Next",    colour: C.blue,  dot: C.blue  },
  idea: { label: "Idea",    colour: C.dim,   dot: C.ghost },
};
const ORDER = ["done", "now", "next", "idea"];

const field = {
  width: "100%", boxSizing: "border-box", background: C.composer,
  border: `1px solid ${C.composerLine}`, borderRadius: 8,
  padding: "9px 11px", color: C.body, font: `400 13.5px ${SANS}`, outline: "none",
};

function Ref({ value }) {
  const [kind, ...rest] = value.split(":");
  const val = rest.join(":");
  return (
    <span style={{
      font: `400 10.5px ${MONO}`, color: kind === "commit" ? C.gold : C.muted,
      background: kind === "commit" ? C.goldWash : "#151515",
      border: `1px solid ${kind === "commit" ? C.goldLine : C.surfaceLine}`,
      borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap",
    }} title={kind === "commit" ? "git commit" : "project document"}>{val}</span>
  );
}

function Entry({ e, first, last, onSave, onDelete, onMove }) {
  // draft is only meaningful while editing, so it's seeded when edit opens
  // rather than synced from the prop with an effect.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(e);
  const [openNotes, setOpen]  = useState(false);
  const s = STATUS[e.status] || STATUS.idea;

  const startEditing = () => { setDraft(e); setEditing(true); };

  const cycleStatus = () => {
    const nextStatus = ORDER[(ORDER.indexOf(e.status) + 1) % ORDER.length];
    onSave(e.id, { status: nextStatus });
  };

  return (
    <div style={{ display: "flex", gap: 16, position: "relative" }}>
      {/* rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flexShrink: 0 }}>
        <button
          onClick={cycleStatus}
          title={`${s.label} — click to change`}
          style={{
            width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 6,
            background: e.status === "done" ? s.dot : "transparent",
            border: `2px solid ${s.dot}`, padding: 0, cursor: "pointer",
          }}
        />
        {!last && <div style={{ flex: 1, width: 1, background: C.surfaceLine, marginTop: 4 }} />}
      </div>

      {/* card */}
      <div style={{
        flex: 1, marginBottom: 22, background: C.surface,
        border: `1px solid ${e.status === "now" ? C.goldLine : C.surfaceLine}`,
        borderRadius: 12, padding: "14px 16px",
      }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <input style={field} value={draft.title || ""}
                   onChange={ev => setDraft({ ...draft, title: ev.target.value })} placeholder="Title" />
            <textarea style={{ ...field, minHeight: 74, resize: "vertical", lineHeight: 1.6 }}
                      value={draft.body || ""} placeholder="What changed, or what needs doing"
                      onChange={ev => setDraft({ ...draft, body: ev.target.value })} />
            <textarea style={{ ...field, minHeight: 56, resize: "vertical", lineHeight: 1.6 }}
                      value={draft.notes || ""} placeholder="Notes — your own thinking"
                      onChange={ev => setDraft({ ...draft, notes: ev.target.value })} />
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <input style={{ ...field, maxWidth: 150 }} value={draft.occurred_at || ""}
                     placeholder="YYYY-MM-DD"
                     onChange={ev => setDraft({ ...draft, occurred_at: ev.target.value })} />
              <select style={{ ...field, maxWidth: 130, cursor: "pointer" }} value={draft.status}
                      onChange={ev => setDraft({ ...draft, status: ev.target.value })}>
                {ORDER.map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
              </select>
              <input style={{ ...field, flex: 1, minWidth: 180, font: `400 12px ${MONO}` }}
                     value={(draft.refs || []).join(", ")}
                     placeholder="commit:abc1234, doc:STATE.md"
                     onChange={ev => setDraft({
                       ...draft,
                       refs: ev.target.value.split(",").map(x => x.trim()).filter(Boolean),
                     })} />
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 3 }}>
              <button onClick={() => { onSave(e.id, draft); setEditing(false); }}
                      style={{ padding: "7px 15px", borderRadius: 8, border: "none",
                               background: `linear-gradient(135deg,${C.gold},${C.goldDim})`,
                               color: C.bg, font: `500 12.5px ${SANS}`, cursor: "pointer" }}>Save</button>
              <button onClick={() => { setDraft(e); setEditing(false); }}
                      style={{ padding: "7px 15px", borderRadius: 8, background: "transparent",
                               border: `1px solid ${C.composerLine}`, color: C.dim,
                               font: `400 12.5px ${SANS}`, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => onDelete(e.id)}
                      style={{ marginLeft: "auto", padding: "7px 15px", borderRadius: 8,
                               background: "transparent", border: `1px solid #3a2222`,
                               color: C.red, font: `400 12.5px ${SANS}`, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ font: `500 11px ${SANS}`, letterSpacing: 1, textTransform: "uppercase",
                             color: s.colour }}>{s.label}</span>
              <span style={{ font: `400 11.5px ${MONO}`, color: C.faint }}>
                {e.occurred_at || "not dated"}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
                <button onClick={() => onMove(e.id, -1)} disabled={first} title="Move up"
                        style={{ background: "none", border: "none", color: first ? C.ghost : C.dim,
                                 font: `400 13px ${SANS}`, cursor: first ? "default" : "pointer",
                                 padding: "0 3px" }}>↑</button>
                <button onClick={() => onMove(e.id, 1)} disabled={last} title="Move down"
                        style={{ background: "none", border: "none", color: last ? C.ghost : C.dim,
                                 font: `400 13px ${SANS}`, cursor: last ? "default" : "pointer",
                                 padding: "0 3px" }}>↓</button>
                <button onClick={startEditing} title="Edit"
                        style={{ background: "none", border: "none", color: C.dim,
                                 font: `400 11.5px ${SANS}`, cursor: "pointer", padding: "0 3px" }}>edit</button>
              </div>
            </div>

            <h3 style={{ margin: "7px 0 0", font: `500 17px ${SERIF}`, color: C.head }}>{e.title}</h3>
            {e.body && (
              <p style={{ margin: "7px 0 0", font: `400 13.5px/1.65 ${SANS}`, color: C.body }}>{e.body}</p>
            )}

            {e.refs?.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {e.refs.map(r => <Ref key={r} value={r} />)}
              </div>
            )}

            {e.notes && (
              <div style={{ marginTop: 11 }}>
                <button onClick={() => setOpen(o => !o)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                                 font: `400 11.5px ${SANS}`, color: C.faint, letterSpacing: .4 }}>
                  {openNotes ? "▾ notes" : "▸ notes"}
                </button>
                {openNotes && (
                  <p style={{
                    margin: "7px 0 0", padding: "9px 12px", borderRadius: 8,
                    background: C.goldWash, border: `1px solid ${C.goldLine}`,
                    font: `400 13px/1.65 ${SANS}`, color: C.muted,
                  }}>{e.notes}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Owner() {
  const [entries, setEntries] = useState(null);
  const [denied, setDenied]   = useState(null);
  const [filter, setFilter]   = useState("all");
  const [adding, setAdding]   = useState(false);
  const [newEntry, setNew]    = useState({ title: "", body: "", status: "idea" });

  // Load once on mount. Written inline (rather than calling a helper) so the
  // state updates happen in the fetch callback, not in the effect body.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/owner/timeline`)
      .then(async res => {
        if (cancelled) return;
        if (res.status === 403) {
          setDenied((await res.json()).detail || "Not the owner.");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setEntries(await res.json());
      })
      .catch(err => { if (!cancelled) setDenied(`Couldn't reach the backend — ${err.message}`); });
    return () => { cancelled = true; };
  }, []);

  const save = async (id, patch) => {
    const res = await fetch(`${API}/owner/timeline/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setEntries(list => list.map(x => (x.id === id ? updated : x)));
    }
  };

  const remove = async (id) => {
    const res = await fetch(`${API}/owner/timeline/${id}`, { method: "DELETE" });
    if (res.ok) setEntries(list => list.filter(x => x.id !== id));
  };

  // Reordering writes the whole order back, so positions can't drift apart.
  const move = async (id, delta) => {
    const idx = entries.findIndex(x => x.id === id);
    const to  = idx + delta;
    if (idx < 0 || to < 0 || to >= entries.length) return;
    const next = [...entries];
    [next[idx], next[to]] = [next[to], next[idx]];
    setEntries(next);                                  // optimistic
    const res = await fetch(`${API}/owner/timeline/reorder`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map(x => x.id) }),
    });
    if (res.ok) {
      setEntries(await res.json());
    } else {
      // Server wins on failure — re-read rather than keep the optimistic order.
      const fresh = await fetch(`${API}/owner/timeline`);
      if (fresh.ok) setEntries(await fresh.json());
    }
  };

  const add = async () => {
    if (!newEntry.title.trim()) return;
    const res = await fetch(`${API}/owner/timeline`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEntry),
    });
    if (res.ok) {
      const created = await res.json();
      setEntries(list => [...list, created]);
      setNew({ title: "", body: "", status: "idea" });
      setAdding(false);
    }
  };

  if (denied) return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "60px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ font: `500 26px ${SERIF}`, color: C.head, margin: "0 0 12px" }}>
          Owner page
        </h1>
        <p style={{ font: `400 14px/1.7 ${SANS}`, color: C.muted, margin: 0 }}>{denied}</p>
        <p style={{ font: `400 13px/1.7 ${SANS}`, color: C.faint, marginTop: 14 }}>
          This page is deliberately unreachable through the tunnel — no key is
          shipped to the browser, so there is nothing here for a visitor to find.
          Open it on the machine running the backend.
        </p>
      </div>
    </div>
  );

  if (!entries) return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 40 }}>
      <p style={{ font: `400 14px ${SANS}`, color: C.faint }}>Loading…</p>
    </div>
  );

  const counts = ORDER.reduce((a, k) => ({ ...a, [k]: entries.filter(e => e.status === k).length }), {});
  const shown  = filter === "all" ? entries : entries.filter(e => e.status === filter);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "40px 24px 90px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <header style={{ marginBottom: 26 }}>
          <a href="/chat" style={{ font: `400 12px ${SANS}`, color: C.dim, textDecoration: "none" }}>
            ← Back to chat
          </a>
          <h1 style={{ margin: "14px 0 6px", font: `500 30px ${SERIF}`, color: C.head }}>
            Project timeline
          </h1>
          <p style={{ margin: 0, font: `400 13.5px/1.6 ${SANS}`, color: C.faint }}>
            Where Lucchese has been and what's next. Owner-only — this page is served
            locally and never through the tunnel.
          </p>
        </header>

        <div style={{ display: "flex", gap: 7, marginBottom: 26, flexWrap: "wrap" }}>
          {["all", ...ORDER].map(k => {
            const on = filter === k;
            const label = k === "all" ? `All ${entries.length}` : `${STATUS[k].label} ${counts[k]}`;
            return (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding: "5px 12px", borderRadius: 7, cursor: "pointer",
                background: on ? C.goldWash : "transparent",
                border: `1px solid ${on ? C.goldLine : C.surfaceLine}`,
                color: on ? C.gold : C.dim, font: `400 12px ${SANS}`,
              }}>{label}</button>
            );
          })}
          <button onClick={() => setAdding(a => !a)} style={{
            marginLeft: "auto", padding: "5px 14px", borderRadius: 7, cursor: "pointer",
            background: adding ? "transparent" : `linear-gradient(135deg,${C.gold},${C.goldDim})`,
            border: adding ? `1px solid ${C.composerLine}` : "none",
            color: adding ? C.dim : C.bg, font: `500 12px ${SANS}`,
          }}>{adding ? "Cancel" : "+ Add entry"}</button>
        </div>

        {adding && (
          <div style={{
            background: C.surface, border: `1px solid ${C.goldLine}`, borderRadius: 12,
            padding: 16, marginBottom: 26, display: "flex", flexDirection: "column", gap: 9,
          }}>
            <input style={field} autoFocus placeholder="Title"
                   value={newEntry.title}
                   onChange={e => setNew({ ...newEntry, title: e.target.value })}
                   onKeyDown={e => e.key === "Enter" && add()} />
            <textarea style={{ ...field, minHeight: 66, resize: "vertical" }}
                      placeholder="What is it, and why does it matter?"
                      value={newEntry.body}
                      onChange={e => setNew({ ...newEntry, body: e.target.value })} />
            <div style={{ display: "flex", gap: 9 }}>
              <select style={{ ...field, maxWidth: 130, cursor: "pointer" }}
                      value={newEntry.status}
                      onChange={e => setNew({ ...newEntry, status: e.target.value })}>
                {ORDER.map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
              </select>
              <button onClick={add} style={{
                padding: "8px 18px", borderRadius: 8, border: "none",
                background: `linear-gradient(135deg,${C.gold},${C.goldDim})`,
                color: C.bg, font: `500 12.5px ${SANS}`, cursor: "pointer",
              }}>Add</button>
            </div>
          </div>
        )}

        {shown.length === 0 && (
          <p style={{ font: `400 13.5px ${SANS}`, color: C.faint }}>Nothing with that status.</p>
        )}

        {shown.map((e, i) => (
          <Entry
            key={e.id}
            e={e}
            first={i === 0}
            last={i === shown.length - 1}
            onSave={save}
            onDelete={remove}
            onMove={move}
          />
        ))}
      </div>
    </div>
  );
}
