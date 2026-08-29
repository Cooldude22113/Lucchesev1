import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import AdminPanel from "./AdminPanel";
import Home from "./Home";
import ReactMarkdown from "react-markdown";
import Voice from "./Voice";
import Settings from "./Settings";

const API = import.meta.env.VITE_API_URL || "https://api.lucchese.app";

const DOC_MARKER = /\[GENERATE_DOC:\s*([^\]]+)\]/i;

// ── Palette ───────────────────────────────────────────────────────────────────
// Gold marks anything that is Lucchese's own voice; everything else is ink.
const C = {
  bg:           "#0a0a0a",
  rail:         "#0c0c0c",
  railLine:     "#171717",
  surface:      "#131313",
  surfaceLine:  "#1f1f1f",
  composer:     "#101010",
  composerLine: "#242424",
  hairline:     "#1c1c1c",
  gold:         "#c8a96e",
  goldDim:      "#8b6914",
  goldInk:      "#1a1712",
  goldLine:     "#2e2718",
  goldWash:     "#12100c",
  head:         "#e8e0d0",
  body:         "#d5cdbe",
  muted:        "#8b8578",
  dim:          "#6f6759",
  faint:        "#4a4438",
  ghost:        "#3a3a3a",
  green:        "#4caf7d",
  red:          "#e06c75",
};

const SERIF = "'Playfair Display', Georgia, serif";
const SANS  = "'DM Sans', system-ui, sans-serif";
const MONO  = "ui-monospace, Consolas, monospace";

// ── Icons ─────────────────────────────────────────────────────────────────────
const stroked = (size, stroke, width) => ({
  width: size, height: size, viewBox: "0 0 24 24",
  fill: "none", stroke, strokeWidth: width,
});

function IconMic({ size = 13, stroke = "currentColor", width = 1.8 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconDoc({ size = 13, stroke = "currentColor", width = 2 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconPlus({ size = 12, stroke = "currentColor", width = 2.5 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconMenu({ size = 15, stroke = "currentColor", width = 2 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconSend({ size = 14, stroke = "currentColor", width = 2.4 }) {
  return (
    <svg {...stroked(size, stroke, width)} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconClose({ size = 16, stroke = "currentColor", width = 2 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconTrash({ size = 13, stroke = "currentColor", width = 2 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function IconUpload({ size = 22, stroke = "currentColor", width = 1.5 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconDownload({ size = 14, stroke = "currentColor", width = 2.5 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCheck({ size = 12, stroke = "currentColor", width = 2.5 }) {
  return (
    <svg {...stroked(size, stroke, width)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconThumbUp({ size = 13, stroke = "currentColor", width = 2, fill = "none" }) {
  return (
    <svg {...stroked(size, stroke, width)} fill={fill}>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function IconThumbDown({ size = 13, stroke = "currentColor", width = 2, fill = "none" }) {
  return (
    <svg {...stroked(size, stroke, width)} fill={fill}>
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

// ── Small shared pieces ───────────────────────────────────────────────────────

/** The gold hairline that tops every surface Lucchese owns. It shimmers while a
 *  request is open, so the bubble never changes geometry when tokens arrive. */
function GoldEdge({ live = false }) {
  return (
    <div style={{
      height: 1,
      background: live
        ? `linear-gradient(90deg,${C.gold},${C.goldDim} 30%,${C.goldDim}33 55%,transparent)`
        : `linear-gradient(90deg,${C.gold}88,${C.goldDim}33 40%,transparent)`,
      backgroundSize: live ? "280px 100%" : undefined,
      animation:      live ? "luShimmer 1.8s linear infinite" : undefined,
    }} />
  );
}

function Mark({ size = 30 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg,${C.gold},${C.goldDim})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      font: `700 ${Math.round(size * 0.43)}px ${SERIF}`,
      color: C.bg, flexShrink: 0,
    }}>L</div>
  );
}

function StatusDot({ tone, live }) {
  const colour = tone === "gold" ? C.gold : tone === "red" ? C.red : C.green;
  return (
    <div style={{
      width: 5, height: 5, borderRadius: "50%", background: colour,
      boxShadow: `0 0 6px ${colour}88`,
      animation: live ? "luBreathe 1.4s ease-in-out infinite" : undefined,
      flexShrink: 0,
    }} />
  );
}

function Caption({ children, colour = C.faint, size = 10.5, gap = 2 }) {
  return (
    <span style={{
      font: `400 ${size}px ${SANS}`, color: colour,
      letterSpacing: gap, textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

// ── Time ──────────────────────────────────────────────────────────────────────
const isSameDay = (a, b) => a.toDateString() === b.toDateString();

function yesterdayOf(now) {
  const d = new Date(now);
  d.setDate(now.getDate() - 1);
  return d;
}

function relativeTime(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const now  = new Date();
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  if (isSameDay(then, now)) {
    const h = then.getHours();
    return h < 12 ? "This morning" : h < 18 ? "This afternoon" : "This evening";
  }
  if (isSameDay(then, yesterdayOf(now))) return "Yesterday";
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function bucketOf(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Earlier";
  const now = new Date();
  if (isSameDay(then, now))              return "Today";
  if (isSameDay(then, yesterdayOf(now))) return "Yesterday";
  return "Earlier";
}

const BUCKETS = ["Today", "Yesterday", "Earlier"];

function groupConversations(convs) {
  const groups = new Map(BUCKETS.map(b => [b, []]));
  convs.forEach(c => groups.get(bucketOf(c.updated_at)).push(c));
  return BUCKETS.map(b => [b, groups.get(b)]).filter(([, list]) => list.length > 0);
}

// ── Fenced code ───────────────────────────────────────────────────────────────
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the code is still selectable */
    }
  };

  return (
    <div style={{
      background: C.composer, border: `1px solid ${C.surfaceLine}`,
      borderRadius: 9, overflow: "hidden", margin: "0 0 14px",
    }}>
      <div style={{
        padding: "7px 12px", borderBottom: "1px solid #1a1a1a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{
          font: `400 10.5px ${MONO}`, color: C.faint,
          letterSpacing: 1.2, textTransform: "uppercase",
        }}>{language || "text"}</span>
        <button onClick={copy} style={{
          font: `400 10.5px ${SANS}`, letterSpacing: 1,
          color: copied ? C.green : "#3d3d3d",
        }}>{copied ? "COPIED" : "COPY"}</button>
      </div>
      <pre style={{
        margin: 0, padding: 12, font: `400 13.5px/1.7 ${MONO}`,
        color: "#b9a887", overflowX: "auto", whiteSpace: "pre",
      }}>{code}</pre>
    </div>
  );
}

/** react-markdown renders a fenced block as <pre><code>. Replacing `pre` here
 *  means the `code` styling in CSS only ever applies to inline code. */
const MD_COMPONENTS = {
  pre({ children }) {
    const child     = Array.isArray(children) ? children[0] : children;
    const className = child?.props?.className || "";
    const match     = /language-([\w-]+)/.exec(className);
    const text      = String(child?.props?.children ?? "").replace(/\n$/, "");
    return <CodeBlock language={match ? match[1] : ""} code={text} />;
  },
};

function MarkdownBody({ children }) {
  return (
    <div className="lu-md">
      <ReactMarkdown components={MD_COMPONENTS}>{children}</ReactMarkdown>
    </div>
  );
}

// ── The Word-doc offer, as a footer card on the reply ─────────────────────────
function DocCard({ content, title, mobile }) {
  const [status, setStatus]     = useState("idle"); // idle | loading | ready | error
  const [token, setToken]       = useState(null);
  const [filename, setFilename] = useState(null);

  const generate = async () => {
    setStatus("loading");
    try {
      const res  = await fetch(`${API}/generate-doc`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content, title }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToken(data.token);
      setFilename(data.filename);
      setStatus("ready");
    } catch (e) {
      console.error("Doc generation error:", e);
      setStatus("error");
    }
  };

  const failed = status === "error";

  // All four states share this shell, so nothing reflows when you click.
  const shell = {
    margin:       mobile ? "0 16px 16px" : "0 24px 22px",
    background:   failed ? "#130f10" : C.goldWash,
    border:       `1px solid ${failed ? "#3a2226" : status === "ready" ? "#3a2f1c" : "#2a2318"}`,
    borderRadius: 11,
    padding:      "13px 14px",
    display:      "flex",
    alignItems:   "center",
    gap:          mobile ? 11 : 14,
  };

  const tile = {
    width: 38, height: 38, borderRadius: 8,
    background: failed ? "#1a1214" : C.goldInk,
    border: `1px solid ${failed ? "#3a2226" : C.goldLine}`,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  };

  if (status === "loading") return (
    <div style={shell}>
      <div style={tile}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          border: `1.5px solid ${C.gold}`, borderTopColor: "transparent",
          animation: "luSpin .8s linear infinite",
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={{ margin: 0, font: `400 13.5px/1.3 ${SANS}`, color: "#b8b0a2" }}>Generating document…</p>
        <p style={{ margin: "4px 0 0", font: `400 11px/1 ${SANS}`, color: "#5a5346" }}>Usually two or three seconds</p>
      </div>
    </div>
  );

  if (status === "ready") return (
    <div style={shell}>
      <div style={tile}><span style={{ font: `400 9.5px ${MONO}`, color: C.gold }}>DOCX</span></div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={{
          margin: 0, font: `400 13px/1.3 ${SANS}`, color: C.body,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{filename}</p>
        <p style={{ margin: "4px 0 0", font: `400 11px/1 ${SANS}`, color: C.green }}>Ready to download</p>
      </div>
      <button
        onClick={() => window.open(`${API}/download/${token}`, "_blank")}
        title="Download"
        style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: `linear-gradient(135deg,${C.gold},${C.goldDim})`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      ><IconDownload stroke={C.bg} /></button>
    </div>
  );

  if (failed) return (
    <div style={shell}>
      <div style={tile}><IconClose size={15} stroke={C.red} /></div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={{ margin: 0, font: `400 13.5px/1.3 ${SANS}`, color: C.red }}>Couldn't generate that</p>
        <p style={{ margin: "4px 0 0", font: `400 11px/1 ${SANS}`, color: "#5a5346" }}>Backend didn't answer — try again</p>
      </div>
      <button onClick={generate} style={{
        height: 30, padding: "0 12px", borderRadius: 8,
        background: "transparent", border: "1px solid #3a2226",
        color: C.red, font: `500 11.5px ${SANS}`, flexShrink: 0,
      }}>Retry</button>
    </div>
  );

  return (
    <div style={shell}>
      <div style={tile}><IconDoc size={16} stroke={C.gold} width={1.6} /></div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <p style={{
          margin: 0, font: `400 15px/1.3 ${SERIF}`, color: C.head,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{title}</p>
        <p style={{
          margin: "4px 0 0", font: `400 11.5px/1 ${SANS}`,
          color: C.dim, letterSpacing: .4,
        }}>{mobile ? "Word document" : "Word document · detected from this reply"}</p>
      </div>
      <button onClick={generate} style={{
        height: 34, padding: "0 15px", borderRadius: 9, flexShrink: 0,
        background: `linear-gradient(135deg,${C.gold}22,${C.gold}11)`,
        border: `1px solid ${C.gold}55`, color: C.gold,
        font: `500 12.5px ${SANS}`, display: "flex", alignItems: "center", gap: 7,
      }}>
        <IconDoc />{mobile ? "Save" : "Save as Word Doc"}
      </button>
    </div>
  );
}

// ── Messages ──────────────────────────────────────────────────────────────────
function Message({ role, content, viaVoice, pending, streaming, isLatest, exchange, model, mobile }) {
  const isUser = role === "user";
  const [rated, setRated] = useState(null);

  const docMatch = isUser ? null : content.match(DOC_MARKER);
  const docTitle = docMatch ? docMatch[1].trim() : null;
  const clean    = content.replace(DOC_MARKER, "").replace(/\n{3,}/g, "\n\n").trim();

  const giveFeedback = async (rating) => {
    setRated(rating);
    if (!exchange) return;
    try {
      await fetch(`${API}/feedback`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...exchange, rating }),
      });
    } catch (e) {
      console.error("Feedback error:", e);
    }
  };

  if (isUser) return (
    <div style={{ display: "flex", justifyContent: "flex-end", animation: "luFadeUp .3s ease both" }}>
      <div style={{
        maxWidth:     mobile ? "84%" : "66%",
        padding:      mobile ? "12px 15px" : "14px 18px",
        borderRadius: mobile ? "15px 15px 5px 15px" : "16px 16px 5px 16px",
        background:   pending ? "#0f0e0c" : `linear-gradient(135deg,${C.gold}26,${C.gold}0f)`,
        border:       pending ? `1px dashed ${C.goldLine}` : `1px solid ${C.gold}3d`,
        font:         pending
          ? `italic 400 ${mobile ? 15 : 15.5}px/1.7 ${SANS}`
          : `400 ${mobile ? 15.5 : 16}px/1.72 ${SANS}`,
        color:        pending ? C.muted : "#ece5d7",
        textAlign:    "left",
        display:      "flex", gap: mobile ? 9 : 10, alignItems: "flex-start",
        wordBreak:    "break-word",
      }}>
        {viaVoice && !pending && (
          <span style={{ marginTop: 6, flexShrink: 0, display: "flex" }} title="Spoken">
            <IconMic size={mobile ? 11 : 12} stroke={C.gold} width={2} />
          </span>
        )}
        <span>{content}</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: mobile ? 9 : 12, animation: "luFadeUp .3s ease both" }}>
      <div style={{ marginTop: mobile ? 3 : 4 }}><Mark size={mobile ? 26 : 30} /></div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          borderRadius: mobile ? "15px 15px 15px 5px" : "16px 16px 16px 5px",
          background:   C.surface,
          border:       `1px solid ${C.surfaceLine}`,
          overflow:     "hidden",
          textAlign:    "left",
        }}>
          <GoldEdge live={streaming} />
          <div
            className={streaming ? "lu-streaming" : undefined}
            style={{ padding: mobile ? "15px 16px 17px" : "20px 24px 22px" }}
          >
            <MarkdownBody>{clean}</MarkdownBody>
          </div>
          {docTitle && <DocCard content={clean} title={docTitle} mobile={mobile} />}
        </div>

        {isLatest && !streaming && (
          <div style={{
            display: "flex", gap: 10, alignItems: "center",
            marginTop: 10, paddingLeft: 6,
          }}>
            <button
              onClick={() => giveFeedback("good")}
              title="Good response — save to memory"
              style={{
                display: "flex", padding: 0,
                color: rated === "good" ? C.green : "#4a4a4a",
                opacity: rated && rated !== "good" ? .35 : 1,
                transition: "opacity .2s, color .2s",
              }}
            ><IconThumbUp fill={rated === "good" ? C.green : "none"} /></button>
            <button
              onClick={() => giveFeedback("bad")}
              title="Bad response — remove from memory"
              style={{
                display: "flex", padding: 0,
                color: rated === "bad" ? C.red : "#4a4a4a",
                opacity: rated && rated !== "bad" ? .35 : 1,
                transition: "opacity .2s, color .2s",
              }}
            ><IconThumbDown fill={rated === "bad" ? C.red : "none"} /></button>
            {exchange?.auto_ingested && !rated && (
              <span style={{ font: `400 11px ${SANS}`, color: C.ghost, letterSpacing: .6 }}>
                Auto-saved to memory
              </span>
            )}
            {model && (
              <span style={{
                marginLeft: "auto", font: `400 11px ${SANS}`,
                color: C.ghost, letterSpacing: .5,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "45%",
              }} title={`Answered by ${model}`}>{model}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Before the first token. Same bubble and hairline as a reply, so the geometry
 *  doesn't jump when text arrives. */
function Thinking({ mobile }) {
  return (
    <div style={{ display: "flex", gap: mobile ? 9 : 12, animation: "luFadeUp .3s ease both" }}>
      <div style={{ marginTop: mobile ? 3 : 4 }}><Mark size={mobile ? 26 : 30} /></div>
      <div style={{
        borderRadius: "16px 16px 16px 5px", background: C.surface,
        border: `1px solid ${C.surfaceLine}`, overflow: "hidden",
      }}>
        <GoldEdge live />
        <div style={{ padding: "15px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {[0, .2, .4].map(delay => (
              <div key={delay} style={{
                width: 5, height: 5, borderRadius: "50%", background: C.gold,
                animation: `luPulse 1.2s ease-in-out ${delay}s infinite`,
              }} />
            ))}
          </div>
          <span style={{
            font: `italic 400 15.5px ${SERIF}`, color: C.muted,
            animation: "luBreathe 1.6s ease-in-out infinite",
          }}>Thinking</span>
        </div>
      </div>
    </div>
  );
}

// ── Voice strip ───────────────────────────────────────────────────────────────
const VOICE_LABEL = { listening: "Listening", thinking: "Thinking", speaking: "Speaking" };

function Bars({ gainRef, count, mobile, height, speed }) {
  const rowRef = useRef(null);

  // One CSS variable drives every bar, so real mic amplitude animates the row
  // without React re-rendering twenty nodes a frame.
  useEffect(() => {
    let frame;
    const tick = () => {
      const node = rowRef.current;
      if (node) node.style.setProperty("--lu-gain", String(gainRef.current));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [gainRef]);

  const shades = [C.gold, `${C.gold}cc`, C.goldDim];

  return (
    <div ref={rowRef} style={{
      display: "flex", alignItems: "center", gap: 3,
      height, flexShrink: mobile ? 1 : 0, width: mobile ? "100%" : undefined,
    }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          width: mobile ? undefined : 3,
          flex: mobile ? 1 : undefined,
          height, borderRadius: 2,
          background: shades[i % shades.length],
          animation: `luBar ${speed}s ease-in-out ${(i * speed) / count}s infinite`,
        }} />
      ))}
    </div>
  );
}

function VoiceStrip({ state, gainRef, seconds, caption, onStop, onSkip, onExit, mobile }) {
  const listening = state === "listening";
  const speaking  = state === "speaking";
  const clock     = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const frame = {
    background:   "linear-gradient(180deg,#16130d,#100e0a)",
    border:       "1px solid #33291a",
    borderRadius: mobile ? 16 : 14,
  };

  // On mobile the strip replaces the composer — thumb reach beats the keyboard.
  if (mobile) return (
    <div style={{ padding: "0 14px 10px", flexShrink: 0 }}>
      <div style={{ ...frame, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: listening ? C.red : C.gold,
            boxShadow: `0 0 10px ${listening ? C.red : C.gold}99`,
            animation: listening ? "luBreathe 1.3s ease-in-out infinite" : undefined,
          }} />
          <Caption colour={C.gold} gap={1.8}>{VOICE_LABEL[state]}</Caption>
          <span style={{ marginLeft: "auto", font: `400 12.5px ${MONO}`, color: C.muted }}>
            {listening ? clock : ""}
          </span>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Bars gainRef={gainRef} count={24} mobile height={34} speed={speaking ? 1.4 : .9} />
        </div>
        {caption && (
          <p style={{
            margin: "0 0 12px", font: `italic 400 13.5px ${SERIF}`,
            color: C.dim, textAlign: "left",
          }}>{caption}</p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={speaking ? onSkip : onStop}
            disabled={state === "thinking"}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              background: speaking ? C.goldInk : "#1c1512",
              border: `1px solid ${speaking ? C.goldLine : "#4a2b2b"}`,
              color: speaking ? C.gold : C.red,
              font: `500 13.5px ${SANS}`, letterSpacing: .4,
            }}
          >{speaking ? "Skip" : "Stop and send"}</button>
          <button onClick={onExit} title="Leave voice mode" style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: "transparent", border: `1px solid ${C.goldLine}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><IconClose stroke={C.goldDim} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      padding: "0 30px 8px", maxWidth: 860, width: "100%",
      margin: "0 auto", boxSizing: "border-box", flexShrink: 0,
    }}>
      <div style={{ ...frame, padding: "14px 18px", display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <div style={{
            width: 9, height: 9, borderRadius: "50%",
            background: listening ? C.red : C.gold,
            boxShadow: `0 0 10px ${listening ? C.red : C.gold}99`,
            animation: listening ? "luBreathe 1.3s ease-in-out infinite" : undefined,
          }} />
          <Caption colour={C.gold} size={11.5} gap={1.8}>{VOICE_LABEL[state]}</Caption>
        </div>
        <Bars gainRef={gainRef} count={speaking ? 10 : 20} height={speaking ? 22 : 30} speed={speaking ? 1.4 : .9} />
        <span style={{
          flex: 1, minWidth: 0, textAlign: "left",
          font: `italic 400 14px ${SERIF}`, color: speaking ? C.muted : C.dim,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{caption}</span>
        {listening && (
          <span style={{ font: `400 13px ${MONO}`, color: C.muted, flexShrink: 0 }}>{clock}</span>
        )}
        {state !== "thinking" && (
          <button
            onClick={speaking ? onSkip : onStop}
            style={{
              height: 32, padding: "0 14px", borderRadius: 9, flexShrink: 0,
              background: speaking ? C.goldInk : "#1c1512",
              border: `1px solid ${speaking ? C.goldLine : "#4a2b2b"}`,
              color: speaking ? C.gold : C.red,
              font: `500 12px ${SANS}`, letterSpacing: .6,
            }}
          >{speaking ? "Skip" : "Stop"}</button>
        )}
        <button onClick={onExit} title="Leave voice mode" style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: "transparent", border: `1px solid ${C.goldLine}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><IconClose size={14} stroke={C.goldDim} /></button>
      </div>
    </div>
  );
}

// ── Documents ─────────────────────────────────────────────────────────────────
function extensionOf(name = "") {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function DocumentsPanel({ onClose, onCountChange }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadOk, setUploadOk]   = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/documents`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setDocuments(list);
      onCountChange?.(list.length);
    } catch (e) {
      console.error("Documents error:", e);
    }
  }, [onCountChange]);

  // Fetch on mount — the setState lands in a promise callback, not the effect body.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadFile = async (file) => {
    if (!file) return;
    const ext = extensionOf(file.name);
    if (!["pdf", "txt", "md"].includes(ext)) {
      setUploadOk(false);
      setUploadMsg("Only PDF, TXT and MD files are supported.");
      return;
    }
    setUploading(true);
    setUploadOk(false);
    setUploadMsg("Uploading and ingesting…");
    const form = new FormData();
    form.append("file", file);
    try {
      const res  = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      setUploadOk(true);
      setUploadMsg(`${data.filename} — ${data.chunk_count} chunks ingested`);
      fetchDocs();
    } catch (e) {
      console.error("Upload error:", e);
      setUploadOk(false);
      setUploadMsg("Upload failed. Check the backend.");
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (id) => {
    await fetch(`${API}/documents/${id}`, { method: "DELETE" });
    fetchDocs();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const totalChunks = documents.reduce((n, d) => n + (d.chunk_count || 0), 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "#000000b3", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxWidth: "100%", maxHeight: "min(640px, 86vh)",
          background: "#0f0f0f", border: "1px solid #232323", borderRadius: 16,
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 40px 90px #000000cc",
        }}
      >
        <GoldEdge />

        <div style={{
          padding: "20px 24px 18px", borderBottom: "1px solid #1a1a1a",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
        }}>
          <div style={{ textAlign: "left" }}>
            <h2 style={{
              margin: 0, font: `400 21px/1.2 ${SERIF}`,
              color: C.head, letterSpacing: 0,
            }}>Documents</h2>
            <p style={{ margin: "5px 0 0", font: `400 13px/1.5 ${SANS}`, color: C.dim }}>
              PDFs and text files Lucchese can search
            </p>
          </div>
          <button onClick={onClose} style={{ color: "#5a5346", padding: 4, display: "flex" }}>
            <IconClose />
          </button>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            margin: "20px 24px 6px",
            border: `1.5px dashed ${dragOver ? C.gold : `${C.gold}66`}`,
            borderRadius: 12, padding: "26px 20px", textAlign: "center", cursor: "pointer",
            background: dragOver ? `${C.gold}14` : `${C.gold}08`,
            transition: "border-color .2s, background .2s",
          }}
        >
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
            <IconUpload stroke={C.gold} />
          </div>
          <p style={{ margin: 0, font: `400 14.5px/1.5 ${SANS}`, color: "#b8b0a2" }}>
            {uploading ? "Ingesting…" : "Drop a file, or click to upload"}
          </p>
          <p style={{ margin: "5px 0 0", font: `400 11.5px/1.5 ${SANS}`, color: C.faint, letterSpacing: .8 }}>
            PDF · TXT · MD
          </p>
          <input
            ref={fileRef} type="file" accept=".pdf,.txt,.md" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); }}
          />
        </div>

        {uploadMsg && (
          <p style={{
            margin: "10px 24px 0", font: `400 12.5px ${SANS}`,
            color: uploadOk ? C.green : C.red,
            display: "flex", alignItems: "center", gap: 7, textAlign: "left",
          }}>
            {uploadOk && <IconCheck />}{uploadMsg}
          </p>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 22px" }}>
          <p style={{
            margin: "0 0 8px", font: `500 9.5px/1 ${SANS}`, color: C.faint,
            letterSpacing: 2, textTransform: "uppercase", textAlign: "left",
          }}>
            {documents.length === 0
              ? "Nothing uploaded yet"
              : `${documents.length} file${documents.length === 1 ? "" : "s"} · ${totalChunks} chunks`}
          </p>
          {documents.map((doc, i) => {
            const ext = extensionOf(doc.filename);
            return (
              <div key={doc.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 0",
                borderBottom: i === documents.length - 1 ? "none" : `1px solid ${C.railLine}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 7,
                  background: "#1a1a1a", border: "1px solid #242424",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {ext === "pdf"
                    ? <IconDoc size={14} stroke={C.gold} width={1.5} />
                    : <span style={{ font: `400 10px ${MONO}`, color: C.muted }}>{(ext || "?").toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <p style={{
                    margin: 0, font: `400 14px/1.4 ${SANS}`, color: C.body,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{doc.filename}</p>
                  <p style={{ margin: "2px 0 0", font: `400 11.5px/1 ${SANS}`, color: "#454136" }}>
                    {doc.chunk_count} chunks · {formatDate(doc.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => deleteDoc(doc.id)}
                  title="Remove"
                  style={{ color: "#3d3d3d", padding: 4, display: "flex", flexShrink: 0 }}
                ><IconTrash /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  conversations, activeId, onSelect, onNew, onDelete,
  docCount, onOpenDocs, mobile, onClose,
}) {
  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  const railButton = {
    width: "100%", padding: "10px 12px",
    background: "transparent", border: "1px solid #232323", borderRadius: 10,
    color: "#b8b0a2", font: `400 13px ${SANS}`,
    display: "flex", alignItems: "center", gap: 8,
  };

  return (
    <div style={{
      width: 240, flexShrink: 0,
      background: C.rail, borderRight: `1px solid ${C.railLine}`,
      display: "flex", flexDirection: "column",
      ...(mobile
        ? { position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 90, boxShadow: "0 0 60px #000000cc" }
        : null),
    }}>
      <div style={{ padding: "22px 18px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ textAlign: "left" }}>
            <a href="/" style={{ textDecoration: "none" }}>
              <p style={{ margin: 0, font: `400 18px/1 ${SERIF}`, color: C.gold, letterSpacing: .4 }}>Lucchese</p>
            </a>
            <p style={{
              margin: "5px 0 16px", font: `400 9.5px/1 ${SANS}`, color: C.ghost,
              letterSpacing: 2.4, textTransform: "uppercase",
            }}>Personal AI</p>
          </div>
          {mobile && (
            <button onClick={onClose} style={{ color: "#5a5346", padding: 4, display: "flex" }}>
              <IconClose size={15} />
            </button>
          )}
        </div>
        <button onClick={onNew} style={railButton}>
          <IconPlus stroke={C.gold} />New conversation
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px" }}>
        {conversations.length === 0 && (
          <p style={{ font: `400 12.5px ${SANS}`, color: C.ghost, padding: "12px 8px", textAlign: "left" }}>
            No conversations yet
          </p>
        )}
        {groups.map(([label, list]) => (
          <div key={label}>
            <p style={{
              margin: "16px 8px 7px", font: `500 9.5px/1 ${SANS}`, color: C.faint,
              letterSpacing: 2, textTransform: "uppercase", textAlign: "left",
            }}>{label}</p>
            {list.map(conv => {
              const active = activeId === conv.id;
              return (
                <div
                  key={conv.id}
                  className="lu-conv"
                  onClick={() => onSelect(conv.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                    background: active ? "#151515" : "transparent",
                    transition: "background .15s",
                  }}
                >
                  <div style={{
                    width: 2, height: 24, borderRadius: 1, flexShrink: 0,
                    background: active ? C.gold : "transparent",
                  }} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{
                      margin: 0, font: `400 13.5px/1.35 ${SANS}`,
                      color: active ? "#ddd5c7" : C.muted,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{conv.title || "Untitled"}</p>
                    <p style={{
                      margin: "3px 0 0", font: `400 11px/1 ${SANS}`,
                      color: active ? "#4a4a4a" : "#3d3d3d",
                    }}>{relativeTime(conv.updated_at)}</p>
                  </div>
                  <button
                    className="lu-del"
                    onClick={e => onDelete(e, conv.id)}
                    title="Delete conversation"
                    style={{ color: "#5a5346", padding: 2, display: "flex", flexShrink: 0 }}
                  ><IconTrash size={12} /></button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: "14px 18px 18px", borderTop: `1px solid ${C.railLine}` }}>
        <button onClick={onOpenDocs} style={railButton}>
          <IconDoc size={12} stroke={C.gold} />Documents
          {docCount !== null && (
            <span style={{
              marginLeft: "auto", font: `400 11px ${SANS}`, color: C.gold,
              background: C.goldInk, border: "1px solid #2a2318",
              borderRadius: 20, padding: "1px 7px",
            }}>{docCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ convCount, docCount, memoryCount, mobile }) {
  const now      = new Date();
  const hour     = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dayStr   = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const counts = [
    convCount   ? `${convCount} conversation${convCount === 1 ? "" : "s"}` : null,
    docCount    ? `${docCount} document${docCount === 1 ? "" : "s"}`       : null,
    memoryCount ? `${memoryCount.toLocaleString()} memories`               : null,
  ].filter(Boolean);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      padding: mobile ? "0 20px 24px" : "0 30px 30px",
      maxWidth: 860, width: "100%", margin: "0 auto", boxSizing: "border-box",
    }}>
      <div style={{ marginBottom: 26 }}><Mark size={46} /></div>
      <p style={{
        margin: "0 0 12px", font: `400 10.5px ${SANS}`, color: C.ghost,
        letterSpacing: 2.6, textTransform: "uppercase", textAlign: "center",
      }}>{dayStr}</p>
      <h2 style={{
        margin: 0, font: `400 ${mobile ? 30 : 44}px/1.15 ${SERIF}`,
        color: C.head, letterSpacing: "-.6px", textAlign: "center",
      }}>{greeting}, Alex.</h2>
      <p style={{ margin: "16px 0 0", font: `400 16px/1.7 ${SANS}`, color: C.dim }}>
        Ready when you are.
      </p>
      {counts.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginTop: 34,
          font: `400 11.5px ${SANS}`, color: "#3a352b", letterSpacing: .6,
          flexWrap: "wrap", justifyContent: "center",
        }}>
          {counts.map((text, i) => (
            <span key={text} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {i > 0 && <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#2a2a2a" }} />}
              {text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Viewport ──────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
const LISTEN_LIMIT = 8; // seconds — matches the hands-free auto-stop in Voice.jsx

function ChatApp() {
  const mobile = useIsMobile();

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [streaming, setStreaming]         = useState(false);
  const [online, setOnline]               = useState(true);
  const [sidebarOpen, setSidebarOpen]     = useState(() => window.innerWidth > 768);
  const [showDocs, setShowDocs]           = useState(false);
  const [docCount, setDocCount]           = useState(null);
  const [memoryCount, setMemoryCount]     = useState(null);
  const [lastExchange, setLastExchange]   = useState(null);

  // Model picker. `model` is a registry id from GET /models; null means "use
  // whatever the backend has as its default".
  const [models, setModels]             = useState([]);
  const [model, setModel]               = useState(() => {
    try { return localStorage.getItem("lucchese.model") || null; } catch { return null; }
  });
  const [modelOpen, setModelOpen]       = useState(false);

  const [voiceMode, setVoiceMode]       = useState(false);
  const [voiceState, setVoiceState]     = useState(null); // listening | thinking | speaking
  const [listenSecs, setListenSecs]     = useState(0);
  const [speakingText, setSpeakingText] = useState("");
  const [audioError, setAudioError]     = useState(null);

  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const audioCtxRef       = useRef(null);
  const amplitudeFrameRef = useRef(null);
  const listenTimerRef    = useRef(null);
  const autoStopRef       = useRef(null);
  const gainRef           = useRef(.7);
  const sourceRef         = useRef(null);
  const ttsQueueRef       = useRef([]);
  const ttsPlayingRef     = useRef(false);
  const ttsCancelledRef   = useRef(false);
  const voiceModeRef      = useRef(false);
  const abortRef          = useRef(null);
  const bottomRef         = useRef(null);
  const inputRef          = useRef(null);
  const sendRef           = useRef(null);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  // The model list. Unavailable models are kept and shown greyed with their
  // reason — "not loaded in Ollama" tells you more than silently hiding it.
  useEffect(() => {
    fetch(`${API}/models`)
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d?.models) ? d.models : [];
        setModels(list);
        setModel(cur => (cur && list.some(m => m.id === cur) ? cur : d?.default || null));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (model) localStorage.setItem("lucchese.model", model);
    } catch { /* private browsing — the picker just won't persist */ }
  }, [model]);

  const activeModel = models.find(m => m.id === model) || null;

  const fetchConversations = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/conversations`);
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Counts behind the empty state and the Documents badge.
  useEffect(() => {
    fetch(`${API}/documents`)
      .then(r => r.json())
      .then(d => setDocCount(Array.isArray(d) ? d.length : null))
      .catch(() => {});
    fetch(`${API}/admin/stats`, { headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY } })
      .then(r => r.json())
      .then(stats => {
        if (!stats || typeof stats !== "object") return;
        const total = Object.values(stats).reduce(
          (n, bucket) => n + (bucket && typeof bucket.total === "number" ? bucket.total : 0), 0,
        );
        setMemoryCount(total || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, voiceState]);

  // Shrinking to phone width collapses the rail back into a drawer.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth <= 768) setSidebarOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Audio plumbing ──────────────────────────────────────────────────────────
  // One AudioContext, created inside a user gesture — iOS suspends any other.
  const getAudioContext = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const startAmplitudeLoop = (analyser) => {
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
      const level = sum / data.length / 40;           // ~0 when silent, ~1 while speaking
      gainRef.current = Math.max(.22, Math.min(1, level));
      amplitudeFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const stopAmplitudeLoop = useCallback(() => {
    if (amplitudeFrameRef.current) cancelAnimationFrame(amplitudeFrameRef.current);
    amplitudeFrameRef.current = null;
    gainRef.current = .7;
  }, []);

  const playAudioBlob = async (blob) => {
    try {
      const ctx     = await getAudioContext();
      const buffer  = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buffer);
      if (ttsCancelledRef.current) return;
      const source  = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      sourceRef.current = source;
      source.start(0);
      await new Promise(resolve => { source.onended = resolve; });
      sourceRef.current = null;
    } catch (err) {
      console.error("Audio play error:", err);
      setAudioError("Couldn't play that reply out loud.");
    }
  };

  const speak = async (text) => {
    if (!voiceModeRef.current || !text.trim()) return;
    try {
      const res = await fetch(`${API}/tts`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      if (!res.ok) { setAudioError("Speech service unavailable."); return; }
      if (ttsCancelledRef.current) return;
      setSpeakingText(text);
      setVoiceState("speaking");
      await playAudioBlob(await res.blob());
    } catch (err) {
      console.error("speak error:", err);
      setAudioError("Couldn't reach the speech service.");
    }
  };

  const drainSpeech = async () => {
    if (ttsPlayingRef.current) return;
    ttsPlayingRef.current = true;
    while (ttsQueueRef.current.length > 0 && !ttsCancelledRef.current) {
      await speak(ttsQueueRef.current.shift());
    }
    ttsPlayingRef.current = false;
    setSpeakingText("");
    setVoiceState(current => (current === "speaking" ? null : current));
  };

  const skipSpeech = useCallback(() => {
    ttsCancelledRef.current = true;
    ttsQueueRef.current     = [];
    try { sourceRef.current?.stop(); } catch { /* already ended */ }
    sourceRef.current = null;
    setSpeakingText("");
    setVoiceState(current => (current === "speaking" ? null : current));
  }, []);

  // ── Recording ───────────────────────────────────────────────────────────────
  const clearListenTimers = () => {
    if (listenTimerRef.current) clearInterval(listenTimerRef.current);
    if (autoStopRef.current)    clearTimeout(autoStopRef.current);
    listenTimerRef.current = null;
    autoStopRef.current    = null;
  };

  const stopRecording = useCallback(() => {
    clearListenTimers();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    stopAmplitudeLoop();
  }, [stopAmplitudeLoop]);

  const handleRecordingStop = async (recorder, stream) => {
    setVoiceState("thinking");
    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
    const ext  = recorder.mimeType?.includes("mp4") ? "mp4"
               : recorder.mimeType?.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("file", blob, `recording.${ext}`);
    try {
      const res  = await fetch(`${API}/transcribe`, { method: "POST", body: form });
      const data = await res.json();
      const text = (data.text || "").trim();
      if (!text) {
        setVoiceState(null);
      } else if (voiceModeRef.current) {
        // Hands-free: a spoken turn goes straight into the same thread.
        sendRef.current?.(text, { viaVoice: true });
      } else {
        setInput(text);
        setVoiceState(null);
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Transcribe error:", err);
      setAudioError("Couldn't transcribe that.");
      setVoiceState(null);
    } finally {
      stream.getTracks().forEach(t => t.stop());
    }
  };

  const startRecording = async () => {
    try {
      setAudioError(null);
      const ctx    = await getAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      startAmplitudeLoop(analyser);

      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", ""]
        .find(m => m === "" || MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      audioChunksRef.current   = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => handleRecordingStop(recorder, stream);
      recorder.start();

      setVoiceState("listening");
      setListenSecs(0);
      listenTimerRef.current = setInterval(() => setListenSecs(s => s + 1), 1000);
      if (voiceModeRef.current) {
        autoStopRef.current = setTimeout(stopRecording, LISTEN_LIMIT * 1000);
      }
    } catch (err) {
      console.error("Mic error:", err);
      setVoiceState(null);
      setAudioError("Microphone access denied or unavailable.");
    }
  };

  const toggleRecording = () => {
    if (voiceState === "listening") stopRecording();
    else if (!voiceState) startRecording();
  };

  const exitVoice = () => {
    stopRecording();
    skipSpeech();
    setVoiceMode(false);
    setVoiceState(null);
  };

  useEffect(() => () => { clearListenTimers(); stopAmplitudeLoop(); }, [stopAmplitudeLoop]);

  // ── Conversations ───────────────────────────────────────────────────────────
  const loadConversation = async (id) => {
    try {
      const res  = await fetch(`${API}/conversations/${id}`);
      const data = await res.json();
      setMessages(data.map(m => ({ role: m.role, content: m.content })));
      setActiveId(id);
      setLastExchange(null);
      if (mobile) setSidebarOpen(false);
    } catch (e) {
      console.error("Load error:", e);
    }
  };

  const newConversation = () => {
    setActiveId(null);
    setMessages([]);
    setLastExchange(null);
    if (mobile) setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const deleteConversation = async (e, id) => {
    e.stopPropagation();
    await fetch(`${API}/conversations/${id}`, { method: "DELETE" });
    if (activeId === id) newConversation();
    fetchConversations();
  };

  // ── Send ────────────────────────────────────────────────────────────────────
  const send = async (override, opts = {}) => {
    const text = (typeof override === "string" ? override : input).trim();
    if (!text || loading) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages(prev => [...prev, { role: "user", content: text, viaVoice: !!opts.viaVoice }]);
    setInput("");
    setLoading(true);
    setStreaming(false);
    ttsCancelledRef.current = false;
    ttsQueueRef.current     = [];
    setVoiceState(voiceModeRef.current ? "thinking" : null);

    const controller = new AbortController();
    abortRef.current = controller;

    let ttsBuffer = "";
    const flushSentences = (force = false) => {
      const boundary = /[.!?]\s/g;
      let match, lastIndex = 0;
      while ((match = boundary.exec(ttsBuffer)) !== null) {
        const sentence = ttsBuffer.slice(lastIndex, match.index + 1).trim();
        if (sentence) ttsQueueRef.current.push(sentence);
        lastIndex = match.index + 2;
      }
      if (lastIndex > 0) ttsBuffer = ttsBuffer.slice(lastIndex);
      if (force && ttsBuffer.trim()) {
        ttsQueueRef.current.push(ttsBuffer.trim());
        ttsBuffer = "";
      }
      if (voiceModeRef.current) drainSpeech();
    };

    try {
      const res = await fetch(`${API}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: text, history, conversation_id: activeId, model }),
        signal:  controller.signal,
      });

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer      = "";
      let fullReply   = "";
      let bubbleAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk;
          try { chunk = JSON.parse(line); } catch { continue; }

          if (chunk.type === "meta") {
            if (!activeId) setActiveId(chunk.conversation_id);
            if (!bubbleAdded) {
              // The backend reports which model actually answered — it may
              // differ from the pick if that one was unknown or unavailable.
              setMessages(prev => [...prev, {
                role: "assistant", content: "",
                model: chunk.model_label || chunk.model || null,
              }]);
              bubbleAdded = true;
              setStreaming(true);
            }
          }

          if (chunk.type === "token") {
            fullReply += chunk.content;
            ttsBuffer += chunk.content;
            flushSentences();
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1] || {};
              updated[updated.length - 1] = { ...last, role: "assistant", content: fullReply };
              return updated;
            });
          }

          if (chunk.type === "done") {
            setLastExchange({
              conversation_id: activeId,
              user_message:    text,
              assistant_reply: fullReply,
              auto_ingested:   chunk.auto_ingested,
            });
            flushSentences(true);
            fetchConversations();
          }
        }
      }
      setOnline(true);
    } catch (e) {
      if (e.name !== "AbortError") {
        setOnline(false);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Something went wrong connecting to the backend.",
        }]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      setStreaming(false);
      // The strip stays up only while there is speech still to play.
      if (!voiceModeRef.current || (ttsQueueRef.current.length === 0 && !ttsPlayingRef.current)) {
        setVoiceState(current => (current === "thinking" ? null : current));
      }
      if (!mobile) inputRef.current?.focus();
    }
  };

  // Whisper's onstop callback fires long after the render that set it up, so it
  // reaches send() through a ref that always holds the current closure.
  useEffect(() => { sendRef.current = send; });

  const stopReply = useCallback(() => {
    abortRef.current?.abort();
    skipSpeech();
  }, [skipSpeech]);

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  useEffect(() => {
    const onEscape = (e) => {
      if (e.key !== "Escape") return;
      if (loading)                        stopReply();
      else if (voiceState === "listening") stopRecording();
      else if (voiceState === "speaking")  skipSpeech();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [loading, voiceState, stopReply, stopRecording, skipSpeech]);

  // ── Derived header / strip state ────────────────────────────────────────────
  const activeTitle = activeId
    ? conversations.find(c => c.id === activeId)?.title || "Conversation"
    : null;

  const stripCaption = voiceState === "listening"
    ? (voiceMode ? `Sends on its own after ${LISTEN_LIMIT} seconds.` : "Tap stop when you're done.")
    : voiceState === "speaking"
      ? (speakingText ? `"${speakingText}"` : "")
      : "Working out what to say.";

  const hint = loading ? "ESC TO STOP" : voiceMode ? "SPOKEN REPLIES ON" : "ENTER TO SEND";

  const showThinking = loading && messages[messages.length - 1]?.role !== "assistant";
  const showEmpty    = messages.length === 0 && !loading && !voiceState;
  const canSend      = !!input.trim() && !loading;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; color: ${C.head}; font-family: ${SANS};
               height: 100vh; height: 100svh; overflow: hidden; }
        #root { height: 100vh; height: 100svh; }

        @keyframes luFadeUp  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes luPulse   { 0%,100% { opacity:.3; transform: scale(.8); } 50% { opacity:1; transform: scale(1.1); } }
        @keyframes luSpin    { to { transform: rotate(360deg); } }
        @keyframes luBreathe { 0%,100% { opacity:.55; } 50% { opacity:1; } }
        @keyframes luCaret   { 0%,49% { opacity:1; } 50%,100% { opacity:0; } }
        @keyframes luShimmer { 0% { background-position:-180px 0; } 100% { background-position:280px 0; } }
        /* --lu-gain is written from the mic analyser, so the bars are real amplitude. */
        @keyframes luBar {
          0%,100% { transform: scaleY(calc(.28 * var(--lu-gain, 1))); }
          50%     { transform: scaleY(var(--lu-gain, 1)); }
        }

        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }

        button { cursor: pointer; border: none; outline: none; background: none; font-family: ${SANS}; }
        button:disabled { opacity: .4; cursor: not-allowed; }

        textarea {
          resize: none; outline: none; border: none; background: transparent;
          color: ${C.head}; font: 400 15.5px/1.6 ${SANS};
          width: 100%; display: block;
        }
        textarea::placeholder { color: #474338; }

        .lu-conv:hover { background: #141414 !important; }
        .lu-del { opacity: 0; transition: opacity .2s; }
        .lu-conv:hover .lu-del { opacity: 1; }

        /* ── Reply typography: a long answer reads as an article, not a wall ── */
        .lu-md { text-align: left; }
        .lu-md > *:first-child { margin-top: 0 !important; padding-top: 0 !important; border-top: none !important; }
        .lu-md > *:last-child  { margin-bottom: 0 !important; }
        .lu-md p { margin: 0 0 16px; font: 400 16.5px/1.72 ${SANS}; color: ${C.body}; }
        .lu-md h1, .lu-md h2, .lu-md h3, .lu-md h4, .lu-md h5, .lu-md h6 {
          margin: 0 0 12px; padding-top: 16px; border-top: 1px solid ${C.hairline};
          font-family: ${SERIF}; font-weight: 400; line-height: 1.3;
          color: ${C.head}; letter-spacing: 0;
        }
        .lu-md h1 { font-size: 22px; }
        .lu-md h2 { font-size: 19px; }
        .lu-md h3, .lu-md h4, .lu-md h5, .lu-md h6 { font-size: 17px; }
        .lu-md ul, .lu-md ol {
          list-style: none; padding: 0; margin: 0 0 18px;
          display: flex; flex-direction: column; gap: 8px;
        }
        /* The marker is absolutely placed rather than a flex item — a flex li would
           split "**Bold.** trailing text" into two items and wrap them apart. */
        .lu-md li {
          position: relative; padding-left: 25px;
          font: 400 16px/1.7 ${SANS}; color: #cdc5b6;
        }
        .lu-md li > p { margin: 0; font: inherit; color: inherit; }
        .lu-md li > p + p { margin-top: 6px; }
        .lu-md ul > li::before {
          content: "—"; position: absolute; left: 0; top: 0; color: ${C.goldDim};
        }
        .lu-md ol { counter-reset: lu-ol; }
        .lu-md ol > li { counter-increment: lu-ol; padding-left: 28px; }
        .lu-md ol > li::before {
          content: counter(lu-ol) "."; position: absolute; left: 0; top: 0;
          color: ${C.goldDim}; font: 400 14px/1.94 ${MONO};
        }
        .lu-md li > ul, .lu-md li > ol { margin: 8px 0 0; }
        .lu-md strong { color: ${C.gold}; font-weight: 500; }
        .lu-md em { font-style: italic; }
        .lu-md a { color: ${C.gold}; text-decoration: underline; text-underline-offset: 3px; }
        .lu-md code {
          font: 400 14px ${MONO}; background: #1b1b1b;
          padding: 2px 6px; border-radius: 4px; color: ${C.gold};
        }
        .lu-md blockquote {
          margin: 0 0 16px; padding-left: 14px; border-left: 2px solid ${C.goldLine};
          font-style: italic; color: ${C.muted};
        }
        .lu-md hr { border: none; border-top: 1px solid ${C.hairline}; margin: 18px 0; }
        .lu-md img { max-width: 100%; border-radius: 8px; }

        /* The caret trails the last line rather than starting a new one. */
        .lu-streaming .lu-md > *:last-child::after {
          content: ""; display: inline-block; width: 8px; height: 17px;
          background: ${C.gold}; vertical-align: -3px; margin-left: 3px;
          animation: luCaret 1s step-end infinite;
        }

        @media (max-width: 768px) {
          .lu-md p { font-size: 15.5px; line-height: 1.7; margin-bottom: 14px; }
          .lu-md li { font-size: 15px; line-height: 1.65; padding-left: 22px; }
          .lu-md h1 { font-size: 19px; }
          .lu-md h2 { font-size: 17px; }
          .lu-md h3, .lu-md h4, .lu-md h5, .lu-md h6 { font-size: 16px; }
          .lu-md h1, .lu-md h2, .lu-md h3, .lu-md h4 { padding-top: 13px; margin-bottom: 10px; }
          .lu-del { opacity: 1; }
        }
      `}</style>

      {showDocs && (
        <DocumentsPanel onClose={() => setShowDocs(false)} onCountChange={setDocCount} />
      )}

      <div style={{ display: "flex", height: "100%", background: C.bg }}>

        {mobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: "fixed", inset: 0, background: "#000000b3", zIndex: 89 }}
          />
        )}

        {sidebarOpen && (
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={loadConversation}
            onNew={newConversation}
            onDelete={deleteConversation}
            docCount={docCount}
            onOpenDocs={() => { setShowDocs(true); if (mobile) setSidebarOpen(false); }}
            mobile={mobile}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Top bar */}
          <div style={{
            padding: mobile ? "14px 16px 12px" : "16px 30px 14px",
            display: "flex", alignItems: "center", gap: mobile ? 12 : 14,
            borderBottom: mobile ? `1px solid ${C.railLine}` : "none",
            flexShrink: 0,
          }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              title="Conversations"
              style={{ color: mobile ? C.dim : "#4a4a4a", padding: 2, display: "flex", flexShrink: 0 }}
            ><IconMenu size={mobile ? 17 : 15} /></button>

            {activeTitle ? (
              <span style={{
                flex: 1, minWidth: 0,
                font: `400 ${mobile ? 15.5 : 17}px/1.2 ${SERIF}`, color: "#ddd5c7",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left",
              }}>{activeTitle}</span>
            ) : (
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <Caption colour={C.ghost} gap={2}>New conversation</Caption>
              </span>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              {loading ? (
                <>
                  <StatusDot tone="gold" live />
                  {!mobile && <Caption colour="#7a6f52" gap={1.6}>Replying</Caption>}
                </>
              ) : voiceMode ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "3px 9px", borderRadius: 20,
                  background: "#16130d", border: `1px solid ${C.goldLine}`,
                }}>
                  <IconMic size={10} stroke={C.gold} width={2} />
                  <Caption colour={C.gold} size={9} gap={1.4}>Voice</Caption>
                </div>
              ) : (
                <>
                  <StatusDot tone={online ? "green" : "red"} />
                  {!mobile && (
                    <Caption colour="#454136" gap={1.6}>{online ? "Connected" : "Offline"}</Caption>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Transcript */}
          {showEmpty ? (
            <EmptyState
              convCount={conversations.length}
              docCount={docCount}
              memoryCount={memoryCount}
              mobile={mobile}
            />
          ) : (
            <div style={{
              flex: 1, overflowY: "auto",
              padding: mobile ? "18px 16px 8px" : "10px 30px 8px",
              maxWidth: 860, width: "100%", margin: "0 auto", boxSizing: "border-box",
              display: "flex", flexDirection: "column", gap: mobile ? 20 : 30,
            }}>
              {messages.map((m, i) => (
                <Message
                  key={i}
                  {...m}
                  streaming={streaming && i === messages.length - 1 && m.role === "assistant"}
                  isLatest={i === messages.length - 1 && m.role === "assistant"}
                  exchange={i === messages.length - 1 && m.role === "assistant" ? lastExchange : null}
                  mobile={mobile}
                />
              ))}
              {showThinking && <Thinking mobile={mobile} />}
              {voiceState === "thinking" && !loading && (
                <Message role="user" content="Transcribing…" pending mobile={mobile} />
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Voice strip — one strip, three states, so it never moves */}
          {voiceState && (
            <VoiceStrip
              state={voiceState}
              gainRef={gainRef}
              seconds={listenSecs}
              caption={stripCaption}
              onStop={stopRecording}
              onSkip={skipSpeech}
              onExit={exitVoice}
              mobile={mobile}
            />
          )}

          {/* Composer */}
          {!(mobile && voiceState) && (
            <div style={{
              padding: mobile ? "8px 14px 10px" : "8px 30px 22px",
              maxWidth: 860, width: "100%", margin: "0 auto",
              boxSizing: "border-box", flexShrink: 0,
            }}>
              <div style={{
                background: C.composer, border: `1px solid ${C.composerLine}`,
                borderRadius: 16, padding: mobile ? "12px 12px 10px 16px" : "14px 14px 11px 18px",
                boxShadow: "0 -12px 40px #0a0a0acc",
              }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                  }}
                  onKeyDown={onKey}
                  placeholder={voiceMode ? "Or type instead…" : "Message Lucchese…"}
                  style={{ maxHeight: 140, paddingBottom: mobile ? 10 : 12 }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setVoiceMode(on => { if (on) skipSpeech(); return !on; })}
                    title={voiceMode ? "Voice mode on — replies are spoken" : "Voice mode off"}
                    style={{
                      height: mobile ? 44 : 30,
                      margin: mobile ? "-6px 0" : 0,
                      padding: mobile ? "0 12px" : "0 11px",
                      borderRadius: mobile ? 12 : 8, flexShrink: 0,
                      background: voiceMode ? `linear-gradient(135deg,${C.gold},${C.goldDim})` : "transparent",
                      border: voiceMode ? "none" : `1px solid ${C.composerLine}`,
                      color: voiceMode ? C.bg : "#5a5346",
                      display: "flex", alignItems: "center", gap: 7,
                    }}
                  >
                    <IconMic size={mobile ? 16 : 13} />
                    {!mobile && (
                      <span style={{ font: `${voiceMode ? 500 : 400} 11.5px ${SANS}`, letterSpacing: .4 }}>
                        Voice mode
                      </span>
                    )}
                  </button>

                  <button
                    onClick={toggleRecording}
                    disabled={voiceState === "thinking" || voiceState === "speaking"}
                    title={voiceState === "listening" ? "Stop recording" : "Record a message"}
                    style={{
                      width: mobile ? 44 : 30, height: mobile ? 44 : 30,
                      margin: mobile ? "-6px 0" : 0,
                      borderRadius: mobile ? 12 : 8, flexShrink: 0,
                      background: voiceState === "listening" ? "#2a1618" : "transparent",
                      border: `1px solid ${voiceState === "listening" ? "#4a2b2b" : C.composerLine}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background .2s",
                    }}
                  >
                    <svg width={mobile ? 14 : 12} height={mobile ? 14 : 12} viewBox="0 0 24 24"
                         fill={voiceState === "listening" ? C.red : "#5a5346"}>
                      <circle cx="12" cy="12" r="6" />
                    </svg>
                  </button>

                  {/* Model picker — which brain answers the next message */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      onClick={() => setModelOpen(o => !o)}
                      title={activeModel ? `Answering with ${activeModel.label}` : "Choose a model"}
                      style={{
                        height: mobile ? 44 : 30,
                        margin: mobile ? "-6px 0" : 0,
                        padding: mobile ? "0 12px" : "0 10px",
                        borderRadius: mobile ? 12 : 8,
                        background: modelOpen ? C.goldWash : "transparent",
                        border: `1px solid ${modelOpen ? C.goldLine : C.composerLine}`,
                        color: activeModel?.available === false ? C.red : C.dim,
                        display: "flex", alignItems: "center", gap: 6,
                        maxWidth: mobile ? 150 : 210,
                      }}
                    >
                      <span style={{
                        font: `400 11.5px ${SANS}`, letterSpacing: .3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {activeModel ? activeModel.label : "Model"}
                      </span>
                      <span style={{ font: `400 8px ${SANS}`, opacity: .7 }}>▼</span>
                    </button>

                    {modelOpen && (
                      <>
                        {/* click-away */}
                        <div onClick={() => setModelOpen(false)}
                             style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                        <div style={{
                          position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 41,
                          minWidth: 260, maxWidth: 340, maxHeight: 300, overflowY: "auto",
                          background: C.surface, border: `1px solid ${C.surfaceLine}`,
                          borderRadius: 12, padding: 6,
                          boxShadow: "0 18px 50px #000000cc",
                        }}>
                          {models.length === 0 && (
                            <p style={{ margin: 0, padding: "10px 12px", font: `400 12px ${SANS}`, color: C.faint }}>
                              No models found — is the backend running?
                            </p>
                          )}
                          {models.map(m => {
                            const on = m.id === model;
                            return (
                              <button
                                key={m.id}
                                disabled={!m.available}
                                onClick={() => { setModel(m.id); setModelOpen(false); }}
                                title={m.note || m.model}
                                style={{
                                  display: "block", width: "100%", textAlign: "left",
                                  padding: "8px 10px", borderRadius: 8, border: "none",
                                  background: on ? C.goldWash : "transparent",
                                  cursor: m.available ? "pointer" : "not-allowed",
                                  opacity: m.available ? 1 : .5,
                                }}
                              >
                                <span style={{
                                  display: "block", font: `${on ? 500 : 400} 12.5px ${SANS}`,
                                  color: on ? C.gold : C.body,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>{m.label}</span>
                                <span style={{
                                  display: "block", marginTop: 2, font: `400 10.5px ${SANS}`,
                                  color: m.available ? C.faint : C.red,
                                }}>
                                  {m.available
                                    ? `${m.provider}${m.streams ? " · streams" : ""}`
                                    : m.note}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {!mobile && (
                    <span style={{
                      marginLeft: "auto", font: `400 10.5px ${SANS}`,
                      color: "#2c2c2c", letterSpacing: 1.3,
                    }}>{hint}</span>
                  )}

                  <button
                    onClick={loading ? stopReply : () => send()}
                    disabled={!loading && !canSend}
                    title={loading ? "Stop" : "Send"}
                    style={{
                      width: mobile ? 44 : 32, height: mobile ? 44 : 32,
                      margin: mobile ? "-6px 0" : 0,
                      marginLeft: "auto",
                      borderRadius: mobile ? 12 : 9, flexShrink: 0,
                      background: canSend ? `linear-gradient(135deg,${C.gold},${C.goldDim})` : "#1a1a1a",
                      border: canSend ? "none" : "1px solid #262626",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background .2s",
                    }}
                  >
                    {loading
                      ? <div style={{ width: 9, height: 9, borderRadius: 2, background: "#5a5346" }} />
                      : <IconSend size={mobile ? 16 : 14} stroke={canSend ? C.bg : "#4a4a4a"} />}
                  </button>
                </div>
              </div>

              {audioError && (
                <p style={{
                  margin: "10px 0 0", textAlign: "center",
                  font: `400 12px ${SANS}`, color: C.red,
                }}>{audioError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function App() {
  const path = window.location.pathname;

  if (path === "/admin") return <AdminPanel />;
  if (path === "/settings") return <Settings />;
  if (path === "/" || path === "/home") return <Home />;
  if (path === "/voice") return <Voice />;

  return <ChatApp />;
}