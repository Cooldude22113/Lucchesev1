import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "https://api.lucchese.app";

const CATEGORY_COLORS = {
  food:       "#e8a87c",
  business:   "#c8a96e",
  operations: "#7cb8e8",
  fitness:    "#7ce8a8",
  health:     "#e87cb8",
  career:     "#a87ce8",
  personal:   "#e8d87c",
  tech:       "#7ce8e8",
  general:    "#666",
};

const SOURCE_COLORS = {
  grok:     "#ff6b6b",
  chatgpt:  "#19c37d",
  lucchese: "#c8a96e",
  explicit: "#7ce8a8",
  document: "#7cb8e8",
  unknown:  "#666",
};

function StatBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: "0.75rem", color: "#aaa", textTransform: "capitalize" }}>{label}</span>
        <span style={{ fontSize: "0.75rem", color: "#666" }}>{value}</span>
      </div>
      <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2 }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: `${pct}%`,
          background: color || "#c8a96e",
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

function CollectionCard({ name, data }) {
  const [tab, setTab] = useState("source");
  const counts = tab === "source" ? data.by_source : data.by_category;
  const colors = tab === "source" ? SOURCE_COLORS : CATEGORY_COLORS;

  return (
    <div style={{
      background: "#0f0f0f", border: "1px solid #1e1e1e",
      borderRadius: 12, padding: "1.2rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <p style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "0.9rem", color: "#e8e0d0",
            textTransform: "capitalize",
          }}>{name}</p>
          <p style={{ fontSize: "0.7rem", color: "#555", marginTop: 2 }}>
            {data.total.toLocaleString()} entries
          </p>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg, #c8a96e22, #c8a96e11)",
          border: "1px solid #c8a96e33",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.85rem", fontWeight: 700, color: "#c8a96e",
          fontFamily: "'Playfair Display', serif",
        }}>
          {data.total > 999 ? `${(data.total / 1000).toFixed(1)}k` : data.total}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
        {["source", "category"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "0.3rem 0.7rem",
            borderRadius: 6,
            background: tab === t ? "#c8a96e22" : "transparent",
            border: `1px solid ${tab === t ? "#c8a96e44" : "#222"}`,
            color: tab === t ? "#c8a96e" : "#555",
            fontSize: "0.7rem", textTransform: "capitalize",
            cursor: "pointer",
          }}>{t}</button>
        ))}
      </div>

      {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, val]) => (
        <StatBar key={key} label={key} value={val} total={data.total} color={colors[key]} />
      ))}
    </div>
  );
}

function RecentMemory({ item }) {
  const catColor = CATEGORY_COLORS[item.category] || "#666";
  const srcColor = SOURCE_COLORS[item.source] || "#666";
  const date = item.created_at ? new Date(item.created_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric"
  }) : "No date";

  return (
    <div style={{
      padding: "0.8rem 1rem",
      borderBottom: "1px solid #141414",
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "0.8rem", color: "#ccc", lineHeight: 1.5,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{item.text}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 5, alignItems: "center" }}>
          <span style={{
            fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4,
            background: `${srcColor}22`, color: srcColor, border: `1px solid ${srcColor}44`,
          }}>{item.source}</span>
          <span style={{
            fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4,
            background: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44`,
          }}>{item.category}</span>
          <span style={{ fontSize: "0.62rem", color: "#444" }}>{date}</span>
        </div>
      </div>
    </div>
  );
}

// ── Debug tab (chat traces) ──────────────────────────────────────────────────
const PATH_COLORS = {
  chat:     "#c8a96e",
  remember: "#7ce8a8",
  forget:   "#e06c75",
};

const TRACE_STATUS_COLORS = {
  ok:      "#7ce8a8",
  partial: "#e8c87c",
  error:   "#e06c75",
};

function Badge({ text, color }) {
  return (
    <span style={{
      fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4,
      background: `${color}22`, color, border: `1px solid ${color}44`,
      whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

function TraceRow({ t, onClick }) {
  const statusColor = TRACE_STATUS_COLORS[t.status] || "#666";
  const time = t.created_at
    ? new Date(t.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div onClick={onClick} style={{
      padding: "0.8rem 1rem", borderBottom: "1px solid #141414",
      display: "flex", gap: 10, alignItems: "center", cursor: "pointer",
    }}>
      <div title={t.status} style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "0.8rem", color: "#ccc", lineHeight: 1.5,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{t.user_message}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
          <Badge text={t.path} color={PATH_COLORS[t.path] || "#666"} />
          {t.model && <Badge text={t.model} color="#7cb8e8" />}
          {!!t.web_search_used && <Badge text="web search" color="#7ce8e8" />}
          <span style={{ fontSize: "0.62rem", color: "#444" }}>{(t.duration_ms / 1000).toFixed(1)}s</span>
          <span style={{ fontSize: "0.62rem", color: "#444" }}>{time}</span>
        </div>
      </div>
      <span style={{ color: "#333", fontSize: "0.8rem" }}>›</span>
    </div>
  );
}

function PipeNode({ label, sub, state }) {
  const styles = {
    ok:      { border: "1px solid #c8a96e88", color: "#c8a96e", background: "#c8a96e11", opacity: 1 },
    error:   { border: "1px solid #e06c75",   color: "#e06c75", background: "#e06c7511", opacity: 1 },
    skipped: { border: "1px solid #333",      color: "#555",    background: "transparent", opacity: 1 },
    off:     { border: "1px solid #222",      color: "#444",    background: "transparent", opacity: 0.45 },
  }[state] || {};
  return (
    <div style={{ padding: "0.4rem 0.65rem", borderRadius: 8, fontSize: "0.68rem", whiteSpace: "nowrap", textAlign: "center", ...styles }}>
      <div>{label}</div>
      {sub && <div style={{ fontSize: "0.58rem", opacity: 0.75, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PipeRow({ label, nodes, taken }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8, paddingLeft: "1.5rem" }}>
      <span style={{ fontSize: "0.62rem", color: taken ? "#888" : "#3a3a3a", width: 110, flexShrink: 0 }}>{label}</span>
      {nodes.map((n, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: taken ? "#444" : "#252525", fontSize: "0.7rem" }}>→</span>}
          <PipeNode {...n} />
        </div>
      ))}
    </div>
  );
}

function PipelineDiagram({ trace }) {
  const steps  = trace.steps || [];
  const byName = {};
  steps.forEach(s => { if (!byName[s.name]) byName[s.name] = s; });

  const isCommand = trace.path === "remember" || trace.path === "forget";
  const stepState = (name, taken) => {
    if (!taken) return "off";
    const s = byName[name];
    if (!s) return "skipped";
    return s.status === "error" ? "error" : s.status === "skipped" ? "skipped" : "ok";
  };

  const deleteSteps = steps.filter(s => s.name === "memory_delete");
  const deleteState = !isCommand ? "off"
    : deleteSteps.length === 0 ? "skipped"
    : deleteSteps.some(s => s.status === "error") ? "error" : "ok";

  const cmdNodes = !isCommand
    ? [{ label: "Remember / Forget", state: "off" }, { label: "Update memory", state: "off" }]
    : trace.path === "forget"
      ? [
          { label: "Forget command", state: "ok" },
          { label: "Delete from memory", state: deleteState },
          { label: "Save reply", state: stepState("save_reply", true) },
        ]
      : [
          { label: "Remember command", state: "ok" },
          { label: "Duplicate check", state: stepState("dedup_check", true) },
          { label: "Classify (Ollama)", state: stepState("classify", true) },
          { label: "Write to memory", state: stepState("memory_write", true) },
          { label: "Save reply", state: stepState("save_reply", true) },
        ];

  const chatTaken = !isCommand;
  const chatNodes = [
    { label: "Web search?", sub: chatTaken ? (trace.web_search_used ? "YES" : "NO") : null, state: stepState("web_search_decision", chatTaken) },
    { label: "DuckDuckGo", state: stepState("web_search", chatTaken) },
    { label: "Build prompt", state: stepState("build_prompt", chatTaken) },
    {
      label: trace.provider === "ollama" ? "Ollama (local)" : "Claude API",
      sub: chatTaken ? trace.model : null,
      state: stepState("model_call", chatTaken),
    },
    { label: "Save reply", state: stepState("save_reply", chatTaken) },
    {
      label: "Memory decision",
      sub: chatTaken ? (byName.ingest ? "SAVE" : byName.ingest_decision ? "not saved" : null) : null,
      state: stepState("ingest_decision", chatTaken),
    },
    { label: "Write to memory", state: stepState("ingest", chatTaken) },
  ];

  return (
    <div style={{
      background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 10,
      padding: "1rem", overflowX: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <PipeNode label="Message received" state={stepState("received", true)} />
        <span style={{ color: "#444", fontSize: "0.7rem" }}>→</span>
        <PipeNode label="Command check" sub={isCommand ? `matched '${trace.path}'` : "no match"} state={stepState("command_check", true)} />
      </div>
      <PipeRow label="Memory command path" nodes={cmdNodes} taken={isCommand} />
      <PipeRow label="Normal chat path" nodes={chatNodes} taken={chatTaken} />
    </div>
  );
}

function StepCard({ step }) {
  const [open, setOpen] = useState(false);
  const mark      = step.status === "error" ? "✗" : step.status === "skipped" ? "○" : "✓";
  const markColor = step.status === "error" ? "#e06c75" : step.status === "skipped" ? "#444" : "#7ce8a8";
  const hasDetail = step.detail && Object.keys(step.detail).length > 0;
  return (
    <div style={{ borderBottom: "1px solid #141414", padding: "0.7rem 1rem" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <span style={{ color: markColor, fontSize: "0.8rem", width: 14, flexShrink: 0 }}>{mark}</span>
        <p style={{ flex: 1, fontSize: "0.8rem", color: step.status === "skipped" ? "#555" : "#ccc", lineHeight: 1.5 }}>
          {step.summary}
        </p>
        <span style={{ fontSize: "0.65rem", color: "#444", whiteSpace: "nowrap" }}>{step.duration_ms} ms</span>
      </div>
      {step.error && (
        <p style={{ fontSize: "0.72rem", color: "#e06c75", margin: "0.4rem 0 0 24px", wordBreak: "break-word" }}>
          {step.error}
        </p>
      )}
      {hasDetail && (
        <div style={{ marginLeft: 24, marginTop: 4 }}>
          <button onClick={() => setOpen(!open)} style={{ fontSize: "0.65rem", color: "#c8a96e99", padding: 0 }}>
            {open ? "▾ hide technical detail" : "▸ show technical detail"}
          </button>
          {open && (
            <pre style={{
              fontSize: "0.65rem", color: "#888", background: "#0a0a0a",
              border: "1px solid #1a1a1a", borderRadius: 6, padding: "0.6rem",
              marginTop: 4, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {JSON.stringify(step.detail, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function TraceDetail({ trace, onBack }) {
  const statusColor = TRACE_STATUS_COLORS[trace.status] || "#666";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{
        background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12,
        padding: "1.2rem 1.5rem",
      }}>
        <button onClick={onBack} style={{ fontSize: "0.72rem", color: "#555", padding: 0, marginBottom: "0.8rem" }}>
          ← Back to all messages
        </button>
        <p style={{ fontSize: "0.9rem", color: "#e8e0d0", lineHeight: 1.5 }}>{trace.user_message}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge text={trace.status} color={statusColor} />
          <Badge text={trace.path} color={PATH_COLORS[trace.path] || "#666"} />
          {trace.model && <Badge text={`${trace.model} (${trace.provider})`} color="#7cb8e8" />}
          {!!trace.web_search_used && <Badge text="web search" color="#7ce8e8" />}
          <span style={{ fontSize: "0.65rem", color: "#444" }}>
            total {(trace.duration_ms / 1000).toFixed(1)}s
          </span>
          <span style={{ fontSize: "0.65rem", color: "#444" }}>
            {trace.created_at && new Date(trace.created_at).toLocaleString("en-GB")}
          </span>
        </div>
      </div>

      <PipelineDiagram trace={trace} />

      <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid #1a1a1a" }}>
          <p style={{ fontSize: "0.8rem", color: "#888" }}>What happened, step by step</p>
        </div>
        {(trace.steps || []).map((s, i) => <StepCard key={i} step={s} />)}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [stats, setStats]             = useState(null);
  const [recent, setRecent]           = useState([]);
  const [search, setSearch]           = useState("");
  const [results, setResults]         = useState([]);
  const [searching, setSearching]     = useState(false);
  const [activeTab, setActiveTab]     = useState("overview");
  const [deleting, setDeleting]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [summarising, setSummarising] = useState(false);
  const [summariseResult, setSummariseResult] = useState(null);
  const [summaries, setSummaries]             = useState([]);
  const [traces, setTraces]                   = useState([]);
  const [selectedTrace, setSelectedTrace]     = useState(null);
  const [loadingTraces, setLoadingTraces]     = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/admin/stats`, { headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }}).then(r => r.json()),
      fetch(`${API}/admin/recent?limit=30`, { headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }}).then(r => r.json()),
      fetch(`${API}/admin/summaries`, { headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }}).then(r => r.json()),
    ]).then(([s, r, su]) => {
      setStats(s);
      setRecent(r);
      setSummaries(Array.isArray(su) ? su : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadTraces = async () => {
    setLoadingTraces(true);
    try {
      const res = await fetch(`${API}/admin/traces?limit=50`, {
        headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }
      });
      const data = await res.json();
      setTraces(Array.isArray(data) ? data : []);
    } catch {
      setTraces([]);
    }
    setLoadingTraces(false);
  };

  useEffect(() => {
    if (activeTab === "debug") loadTraces();
  }, [activeTab]);

  const openTrace = async (id) => {
    try {
      const res = await fetch(`${API}/admin/traces/${id}`, {
        headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }
      });
      if (res.ok) setSelectedTrace(await res.json());
    } catch {
      // keep the list view if the detail fetch fails
    }
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const res = await fetch(`${API}/admin/search?q=${encodeURIComponent(search)}&n=10`, {
      headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }
    });
    const data = await res.json();
    setResults(data);
    setSearching(false);
    setActiveTab("search");
  };

  const deleteSource = async (source) => {
    if (!confirm(`Delete all ${source} entries? This cannot be undone.`)) return;
    setDeleting(source);
    await fetch(`${API}/admin/memory?source=${source}`, {
      method: "DELETE",
      headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }
    });
    const s = await fetch(`${API}/admin/stats`, {
      headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }
    }).then(r => r.json());
    setStats(s);
    setDeleting(null);
  };

  const totalEntries = stats
    ? Object.values(stats).reduce((sum, col) => sum + col.total, 0)
    : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #e8e0d0; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        button { cursor: pointer; border: none; outline: none; background: none; }
        input { outline: none; border: none; background: transparent; color: #e8e0d0; font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <a href="/" style={{ textDecoration: "none" }}>
              <p style={{
                fontFamily: "'Playfair Display', serif", fontSize: "1rem",
                background: "linear-gradient(135deg, #c8a96e, #e8d5a3)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                marginBottom: "0.8rem",
              }}>Lucchese</p>
            </a>
            <p style={{ fontSize: "0.75rem", color: "#444", letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>
              Memory Admin
            </p>
          </div>
          <a href="http://localhost:5173" style={{
            fontSize: "0.75rem", color: "#555", textDecoration: "none",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            ← Back to chat
          </a>
        </div>

        {/* Total stat */}
        {stats && (
          <div style={{
            background: "#0f0f0f", border: "1px solid #1e1e1e",
            borderRadius: 12, padding: "1.2rem 1.5rem",
            marginBottom: "1.5rem",
            display: "flex", gap: "2rem", alignItems: "center",
          }}>
            <div>
              <p style={{ fontSize: "2rem", fontFamily: "'Playfair Display', serif", color: "#c8a96e" }}>
                {totalEntries.toLocaleString()}
              </p>
              <p style={{ fontSize: "0.72rem", color: "#555", marginTop: 2 }}>Total memory entries</p>
            </div>
            {Object.entries(stats).map(([name, data]) => (
              <div key={name} style={{ borderLeft: "1px solid #1a1a1a", paddingLeft: "2rem" }}>
                <p style={{ fontSize: "1.2rem", color: "#e8e0d0", fontFamily: "'Playfair Display', serif" }}>
                  {data.total.toLocaleString()}
                </p>
                <p style={{ fontSize: "0.72rem", color: "#555", marginTop: 2, textTransform: "capitalize" }}>{name}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
          {["overview", "recent", "search", "summaries", "manage", "debug"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "0.45rem 1rem",
              borderRadius: 8,
              background: activeTab === t ? "#c8a96e22" : "#0f0f0f",
              border: `1px solid ${activeTab === t ? "#c8a96e44" : "#1e1e1e"}`,
              color: activeTab === t ? "#c8a96e" : "#555",
              fontSize: "0.78rem", textTransform: "capitalize",
            }}>{t}</button>
          ))}
        </div>

        {/* Search bar — always visible */}
        <div style={{
          display: "flex", gap: 8, marginBottom: "1.5rem",
          background: "#0f0f0f", border: "1px solid #1e1e1e",
          borderRadius: 10, padding: "0.6rem 1rem",
        }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Search memory..."
            style={{ flex: 1, fontSize: "0.85rem" }}
          />
          <button onClick={doSearch} disabled={searching} style={{
            padding: "0.35rem 0.8rem",
            background: "linear-gradient(135deg, #c8a96e, #8b6914)",
            borderRadius: 7, fontSize: "0.75rem", color: "#0a0a0a", fontWeight: 600,
            opacity: searching ? 0.5 : 1,
          }}>
            {searching ? "..." : "Search"}
          </button>
        </div>

        {loading && (
          <p style={{ color: "#444", fontSize: "0.85rem", textAlign: "center", padding: "3rem" }}>
            Loading memory data...
          </p>
        )}

        {/* Overview tab */}
        {activeTab === "overview" && stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {Object.entries(stats).map(([name, data]) => (
              <CollectionCard key={name} name={name} data={data} />
            ))}
          </div>
        )}

        {/* Recent tab */}
        {activeTab === "recent" && (
          <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid #1a1a1a" }}>
              <p style={{ fontSize: "0.8rem", color: "#888" }}>Last 30 ingested facts</p>
            </div>
            {recent.length === 0 ? (
              <p style={{ padding: "2rem", color: "#444", fontSize: "0.8rem", textAlign: "center" }}>Nothing yet</p>
            ) : (
              recent.map((item, i) => <RecentMemory key={i} item={item} />)
            )}
          </div>
        )}

        {/* Search results tab */}
        {activeTab === "search" && (
          <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid #1a1a1a" }}>
              <p style={{ fontSize: "0.8rem", color: "#888" }}>
                {results.length > 0 ? `${results.length} results for "${search}"` : "Run a search above"}
              </p>
            </div>
            {results.map((item, i) => (
              <div key={i} style={{ padding: "0.8rem 1rem", borderBottom: "1px solid #141414" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{
                      fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4,
                      background: `${SOURCE_COLORS[item.source] || "#666"}22`,
                      color: SOURCE_COLORS[item.source] || "#666",
                      border: `1px solid ${SOURCE_COLORS[item.source] || "#666"}44`,
                    }}>{item.source}</span>
                    <span style={{
                      fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4,
                      background: `${CATEGORY_COLORS[item.category] || "#666"}22`,
                      color: CATEGORY_COLORS[item.category] || "#666",
                      border: `1px solid ${CATEGORY_COLORS[item.category] || "#666"}44`,
                    }}>{item.category}</span>
                  </div>
                  <span style={{ fontSize: "0.65rem", color: "#c8a96e" }}>
                    {(item.relevance * 100).toFixed(0)}% match
                  </span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "#bbb", lineHeight: 1.5 }}>{item.text}</p>
                {item.created_at && (
                  <p style={{ fontSize: "0.65rem", color: "#444", marginTop: 4 }}>
                    {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summaries tab */}
        {activeTab === "summaries" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {summaries.length === 0 ? (
              <div style={{
                background: "#0f0f0f", border: "1px solid #1e1e1e",
                borderRadius: 12, padding: "2.5rem",
              }}>
                <p style={{ fontSize: "0.8rem", color: "#444", textAlign: "center" }}>
                  No summaries yet — go to{" "}
                  <span
                    style={{ color: "#c8a96e", cursor: "pointer" }}
                    onClick={() => setActiveTab("manage")}
                  >
                    Manage → Rebuild Summaries
                  </span>
                </p>
              </div>
            ) : (
              summaries.map((item, i) => {
                const catColor = CATEGORY_COLORS[item.category] || "#666";
                const date = item.last_updated
                  ? new Date(item.last_updated).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })
                  : null;
                return (
                  <div key={i} style={{
                    background: "#0f0f0f", border: "1px solid #1e1e1e",
                    borderRadius: 12, padding: "1.2rem 1.5rem",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between", marginBottom: "0.8rem",
                    }}>
                      <span style={{
                        fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4,
                        background: `${catColor}22`, color: catColor,
                        border: `1px solid ${catColor}44`,
                        textTransform: "capitalize",
                      }}>{item.category}</span>
                      {date && (
                        <span style={{ fontSize: "0.65rem", color: "#444" }}>
                          Generated {date}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#ccc", lineHeight: 1.6 }}>
                      {item.summary}
                    </p>
                    {item.entry_count && (
                      <p style={{ fontSize: "0.65rem", color: "#444", marginTop: "0.6rem" }}>
                        {item.entry_count} entries
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Manage tab */}
        {activeTab === "manage" && stats && (
          <>
            {/* Rebuild Summaries */}
            <div style={{
              background: "#0f0f0f", border: "1px solid #1e1e1e",
              borderRadius: 12, padding: "1.2rem 1.5rem", marginBottom: "1rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                <div>
                  <p style={{ fontSize: "0.85rem", color: "#e8e0d0", textAlign: "left" }}>Memory Summaries</p>
                  <p style={{ fontSize: "0.72rem", color: "#555", marginTop: 2 }}>
                    Synthesises your memory clusters into coherent summaries by category
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setSummarising(true);
                    setSummariseResult(null);
                    try {
                      const res = await fetch(`${API}/admin/summarise`, {
                        method: "POST",
                        headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY }
                      });
                      const data = await res.json();
                      setSummariseResult(data);
                    } catch (e) {
                      setSummariseResult({ error: "Failed to connect" });
                    } finally {
                      setSummarising(false);
                    }
                  }}
                  disabled={summarising}
                  style={{
                    padding: "0.5rem 1.2rem",
                    background: summarising ? "#1a1a1a" : "linear-gradient(135deg, #c8a96e, #8b6914)",
                    border: "none", borderRadius: 8,
                    color: summarising ? "#555" : "#0a0a0a",
                    fontSize: "0.78rem", fontWeight: 600,
                    cursor: summarising ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {summarising ? "Building... (takes 1-2 min)" : "Rebuild Summaries"}
                </button>
              </div>
              {summariseResult && !summariseResult.error && (
                <div style={{ marginTop: "0.8rem", fontSize: "0.72rem", color: "#555" }}>
                  ✓ {summariseResult.total_categories} categories processed
                </div>
              )}
              {summariseResult?.error && (
                <p style={{ marginTop: "0.8rem", fontSize: "0.72rem", color: "#e06c75" }}>
                  {summariseResult.error}
                </p>
              )}
            </div>

            {/* Delete by source */}
            <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid #1a1a1a" }}>
                <p style={{ fontSize: "0.8rem", color: "#888" }}>Delete entries by source</p>
                <p style={{ fontSize: "0.7rem", color: "#444", marginTop: 2 }}>This removes from all three collections</p>
              </div>
              {["grok", "chatgpt", "lucchese", "explicit", "document"].map(src => {
                const total = Object.values(stats).reduce((sum, col) => sum + (col.by_source[src] || 0), 0);
                return (
                  <div key={src} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.9rem 1.2rem", borderBottom: "1px solid #141414",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: SOURCE_COLORS[src] || "#666",
                      }} />
                      <span style={{ fontSize: "0.82rem", color: "#ccc", textTransform: "capitalize" }}>{src}</span>
                      <span style={{ fontSize: "0.72rem", color: "#444" }}>{total.toLocaleString()} entries</span>
                    </div>
                    <button
                      onClick={() => deleteSource(src)}
                      disabled={deleting === src || total === 0}
                      style={{
                        padding: "0.35rem 0.8rem",
                        borderRadius: 7,
                        background: total > 0 ? "#e06c7511" : "transparent",
                        border: `1px solid ${total > 0 ? "#e06c7544" : "#222"}`,
                        color: total > 0 ? "#e06c75" : "#333",
                        fontSize: "0.72rem",
                        opacity: deleting === src ? 0.5 : 1,
                      }}
                    >
                      {deleting === src ? "Deleting..." : "Delete all"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Debug tab — chat traces */}
        {activeTab === "debug" && (
          selectedTrace ? (
            <TraceDetail trace={selectedTrace} onBack={() => setSelectedTrace(null)} />
          ) : (
            <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
              <div style={{
                padding: "1rem 1.2rem", borderBottom: "1px solid #1a1a1a",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <p style={{ fontSize: "0.8rem", color: "#888" }}>Recent messages, newest first</p>
                  <p style={{ fontSize: "0.7rem", color: "#444", marginTop: 2 }}>
                    Click one to see exactly what the app did with it
                  </p>
                </div>
                <button onClick={loadTraces} disabled={loadingTraces} style={{
                  padding: "0.35rem 0.8rem", borderRadius: 7,
                  border: "1px solid #c8a96e44", color: "#c8a96e",
                  fontSize: "0.72rem", opacity: loadingTraces ? 0.5 : 1,
                }}>
                  {loadingTraces ? "..." : "Refresh"}
                </button>
              </div>
              {traces.length === 0 ? (
                <p style={{ padding: "2rem", color: "#444", fontSize: "0.8rem", textAlign: "center" }}>
                  {loadingTraces ? "Loading..." : "No traces yet — send a chat message first"}
                </p>
              ) : (
                traces.map(t => <TraceRow key={t.id} t={t} onClick={() => openTrace(t.id)} />)
              )}
            </div>
          )
        )}

      </div>
    </>
  );
}