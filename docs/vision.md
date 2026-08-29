# What Lucchese is for

The thing this document settles: what counts as progress, and what counts as
distraction. Read it when a new idea shows up and you can't tell which it is.

---

## The one-line version

**Lucchese is a character who knows Alex.** Not an assistant with a persona
bolted on — a specific voice with a curated memory of one person's life,
that you can think out loud with.

That distinction is the whole project. Everything below follows from it.

## Why this needs to exist at all

Be honest about the competition: claude.ai is better at code, better at
writing, better at research, and free of maintenance. There is exactly one
thing it cannot do — **know you**. It starts cold every time.

So the only defensible reason for Lucchese to exist is memory and character.
Every feature is either serving that or competing with claude.ai on ground
where Lucchese loses.

That's the filter. Apply it ruthlessly.

## The MVP — one falsifiable sentence

> I can ask Lucchese something I told it three weeks ago, and it answers
> correctly, in character, without me re-explaining anything.

That's it. Not a feature list — a test. Today the app **fails this test**:
`search_memory()` has zero callers, so nothing stored is ever recalled.

Everything in the roadmap either moves toward passing that sentence or waits.

## Non-goals (for now)

Written down so "I want it all" has somewhere to live without derailing
the next three months:

- **Not a task manager or calendar.** Real want, wrong time — it's a feature
  of a thing that works, not a thing that works.
- **Not a coding assistant.** Claude Code already is one. Routing code
  questions to the Claude API is fine; building code features is not.
- **Not multi-user, no auth model, no deployment story.** One user, one PC.
- **Not chasing model quality.** The from-scratch model is a separate learning
  project. Lucchese should treat "the local model" as a config value so
  yours drops in when it's ready — no app work required.

None of these are "never". They're "not until the MVP sentence is true".

---

## The tension to resolve: volume vs intention

Two things said in the same breath, and they contradict:

- *"want to collect as much as possible"*
- *"memories need to be intentional and fit the archetype of lucchese"*

**Intention wins, and it isn't close.** Retrieval quality collapses with
volume. Dumping 4,000 ChatGPT messages into ChromaDB means every search
competes against thousands of throwaway lines about debugging a CSS bug in
2024. The 50 memories that actually define you get buried by noise that
merely *resembles* the query.

A character with 200 curated memories is sharper than one with 20,000 raw
ones. The exports are raw material, not content — they get mined, not poured.

This has a direct consequence: **curation is a first-class feature**, not a
cleanup task. It needs a data model and a UI, both specified below.

---

## Data shapes

### What exists today

Five ChromaDB collections — `knowledge`, `facts`, `style`, `documents`,
`summaries` — with four metadata fields: `source`, `created_at`, `category`,
`chunk_idx`.

Enough to *store*. Not enough to *curate*, and curation is the product.

### What a memory needs

| Field | Why |
|---|---|
| `status` | `candidate` / `canon` / `rejected`. Imports land as candidates and only become canon when reviewed. This is what makes memory intentional rather than accumulated. |
| `provenance` | `typed` (said directly to Lucchese) / `import:chatgpt` / `import:grok` / `inferred` / `document`. A thing you deliberately told it outranks a line scraped from an old transcript. |
| `temporality` | `permanent` (born in Sheffield) / `current` (lives in X, trains 5×/week) / `episodic` (happened on a date). **The biggest failure mode of personal AI is confidently asserting a stale fact.** `current` facts need review dates; `permanent` never expires. |
| `supersedes` | The id of the memory this replaces. Facts change. Dedup (`is_duplicate_memory`) catches repeats, but it does not catch *contradiction* — "I work at X" followed by "I work at Y" leaves both in the database, both retrievable, both stated as true. |
| `subject` | Who or what this is about — self / a named person / a project. Lets you ask "what do you know about my brother" and get a coherent answer. |

`category` and `created_at` stay as they are.

### The curation pipeline

This is the missing feature, and it's what turns your exports into a
character instead of a landfill:

```
export  →  candidate queue  →  review in admin  →  canon  →  retrievable
                                     ↓
                                  rejected
```

Only `canon` memories are searched at chat time. Review happens in the admin
panel — one card at a time: keep / reject / edit / merge into an existing
memory. Bulk import becomes safe, because nothing reaches the character
until it's been looked at.

Realistic scale: reviewing 300 candidates at ~5 seconds each is under half
an hour, and it's the half hour that decides who Lucchese is.

### The character itself

The persona is currently a hardcoded string inside `build_system_prompt()`
in `routes/chat.py`. For a character that develops over time, that's the
wrong home. It should be a versioned file — `docs/character.md` — loaded at
prompt-build time, so the voice has a history you can diff and revert.

Note that `col_style` already exists and is described as "Your writing
style". That collection is how a character learns *voice* rather than
*facts*, and like `search_memory` it is currently never read.

---

## Roadmap

Ordered so each phase makes the next one possible. Resist reordering.

**Phase 0 — Make memory work at all.** Call `search_memory()` in the chat
flow, add results as a section in `build_system_prompt()`, wrap it in a trace
step. Roughly 30 lines. Until this ships, nothing else about this project
matters, and it has been the top item on `STATE.md` for three sessions.
*Done when: the MVP sentence passes.*

**Phase 1 — Curation.** The metadata fields above, the candidate/canon split,
and the review UI in the admin panel. Then import the ChatGPT/Grok/Claude
exports as candidates and actually review them.
*Done when: canon memory is something you chose, not something that accrued.*

**Phase 2 — The character.** Persona out of `chat.py` into `docs/character.md`.
Start reading `col_style`. Tune the voice deliberately — ideology,
anthropology, the conversations you actually want to have.
*Done when: it sounds like Lucchese and not like Claude with a hat on.*

**Phase 3 — Model routing.** Route by topic, with the local model behind a
config value. See the caveat below before building this.

**Later.** Tasks, calendar, proactive nudges, the from-scratch model,
whatever else. All real, all after.

---

## Caveat on model routing

The plan was: personal questions → local model, everything else → Claude.

For a character-driven app that is **backwards**. Personal questions are
exactly where character and memory matter most, and a 27B local model will
break character far more readily than Claude will. Routing sends your most
important conversations to your weakest model.

Unless the reason is **privacy** — not wanting personal history leaving the
machine. That's a legitimate reason and it changes the answer entirely; the
cost is character quality, knowingly paid.

Decide which it is before building. If it's privacy, route personal → local
and accept the trade. If it's cost or speed, route the other way: personal →
Claude, and use the local model for the cheap background work it already does
(classification, summarising).
