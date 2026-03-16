# Product Requirements Document (PRD)

## Extendable Markdown Editor — Composable Documents with Variant Management and Dynamic Context Assembly

---

## 1. Executive Summary

An extendable markdown editor purpose-built for long-form writers (novelists, fanfic authors, worldbuilders, translators) who need capabilities that no existing editor provides:

1. **Composable documents** — assembling smaller documents (scenes, chapters) into larger ones (arcs, volumes, books) through a recursive tree structure, not monolithic files.
2. **First-class variant management** — maintaining multiple alternative versions of any document (original vs. fanfic, full vs. summary, English vs. Japanese) as peers, switchable within compositions without linear versioning semantics.
3. **Dynamic context assembly** — rule-driven presets that automatically select variants and toggle slots based on runtime variables and document tags, resolving into a portable `.md` file usable with any AI client.

The system is architected as two layers:

- **Logic Layer (Engine)** — the resolution engine, rule evaluator, composition walker, and data model. Stateless, pure-function. Shared across all products.
- **Presentation Layer (UI)** — variable management, manual overrides, user state. Product-specific.

Two products share the logic layer:

- **Power App** — a local-first desktop application for authors. Full authoring control. RAG context composition for AI-assisted writing.
- **Reader App** — a web or mobile application for readers. Access-gated document delivery with variant selection driven by user profiles (language, tier, fanfic preference).

---

## 2. Problem Statement

### 2.1 No Editor Supports Composable Documents

Writers organize their work in fragments — scenes, chapters, character profiles, lore entries. But every editor forces these into either monolithic files or completely disconnected ones. There is no way to say "this book is composed of these chapters in this order" and have the editor understand and resolve that relationship.

### 2.2 Versioning Is Linear, Variants Are Not

Existing version control (including document history systems) thinks in timelines: v1 → v2 → v3. Writers need *parallel alternatives*: "chapter 3 original" and "chapter 3 fanfic A" and "chapter 3 darker ending" and "chapter 3 Japanese" all coexisting as first-class, editable documents. None supersedes the others. A composition picks which one to use, and that choice can change at any time — or be determined automatically by rules.

### 2.3 AI Context Assembly Is Manual and Painful

Writing with AI assistance requires feeding the AI relevant context — character profiles, prior chapter summaries, outlines. Today this means manually copy-pasting fragments into prompts. For a 200-chapter novel, this is unsustainable. Writers need a system to curate context bundles that leverage the same composition tree, selecting the right level of detail automatically based on proximity to the current writing position.

### 2.4 No Reader Distribution Path

Authors who build structured, variant-rich works have no way to deliver them to readers with controlled access. A fanfic author with three storyline branches, two languages, and free/paid tiers needs a distribution surface that resolves the right content per reader — not a static export.

---

## 3. Core Concepts

### 3.1 Document

The fundamental unit. A document is one of two kinds:

- **Leaf document**: Contains markdown content. No structural children. This is the actual prose — a scene, a character profile, a chapter.
- **Composition document**: Contains an ordered list of **slots**. No content of its own. Each slot references either a document (leaf or composition) or a variant group. Compositions are recursive — a composition can reference another composition.

A document is *always* one or the other. A document with content cannot have slots. A document with slots cannot have content. There is no hybrid.

### 3.2 Variant Group

A **variant group** is a named set of documents. It is **not** a document. It does not appear in output. It exists solely as a selection mechanism.

Properties:
- Has an ID and a name.
- Contains one or more documents (leaf or composition).
- Cannot contain other variant groups (no nesting).
- Documents within a variant group are ordered.
- **The first document (position 0) is the universal default. It must always be accessible to all users.** This is enforced as a constraint and documented as a convention. For paid content, the default can be a paywall placeholder (e.g., "Please unlock this chapter"). For translations, the default is the original language.

A variant group answers the question: "Which of these alternatives should be used here?" The answer is provided by preset rules, runtime variables, access filtering, or manual selection — in that resolution order.

### 3.3 Composition Slot

A slot is a position within a composition's ordered list. Each slot points to one of:

- **A document** (leaf or composition) — direct, unambiguous reference.
- **A variant group** — requires resolution. The selected member is determined by the rule engine, access filter, and fallback logic.

### 3.4 Tag (Key-Value)

Tags are structured key-value pairs applied to documents. They serve as the primary matching mechanism for the rule engine.

Examples:
- `lang:ja`, `lang:en` — language
- `fanfic:A`, `fanfic:B` — storyline branch
- `tier:free`, `tier:premium` — access tier
- `summary:chapter`, `summary:arc`, `summary:volume` — level of detail
- `arc:1`, `volume:2`, `chapter:103` — structural position
- `char:elara`, `char:mentor` — character relevance

Tags carry the semantics. Variant groups remain dumb containers. The rule engine matches on tag keys and compares values.

### 3.5 Preset (Dynamic)

A preset is a named configuration consisting of:

1. A reference to a **base composition** (the tree to walk).
2. An ordered list of **rules** (`where <premise> do <action>`).
3. Optional **ad-hoc document references** for context inclusion outside the composition tree.

Every preset is dynamic. A preset with zero rules and no manual UI overrides behaves identically to a static preset — group defaults resolve everything. Rules add automation. Manual overrides (applied in the UI/presentation layer, not stored in the engine) add final control.

### 3.6 Rule

A rule is a `where <premise> do <action>` statement. Rules are evaluated in order. Later rules override earlier ones on the same slot.

**Premises** are conditions that can reference:

- **Variables only** — `where var(mode) = reader` — evaluates once, globally. True or false independent of any slot or document. No document/member inspection needed.
- **Tag values on documents/members** — `where tag(chapter) < 103` — evaluates per slot (for toggle actions) or per variant group member (for sort actions).
- **Compound conditions** — AND, OR, NOT combinations of the above.

**Actions**:

- **sort by [value1, value2, ...]** — reorders variant group members by preference. Resolution picks the first accessible member after sorting. The sort values can reference tag keys and variables. Example: `where true sort by [fanfic:B, fanfic:A, ...]` with secondary sort by `tag(lang) matching var(lang)`.
- **toggle off** — excludes matching slots from resolution.
- **toggle on** — includes matching slots (overriding a prior toggle off).
- **select** — hard-select a specific variant by tag match. Equivalent to a sort with one entry.

**Evaluation scope depends on action type:**

- **Sort**: iterates variant group members, evaluates premise against each member's tags, reorders.
- **Toggle**: evaluates premise against the slot's target — if it's a direct document reference, check that document's tags; if it's a variable-only premise, evaluate globally.

### 3.7 Variables

Variables are name-value pairs passed at resolution time. They live in the presentation layer. The engine receives them as input and never stores or mutates them.

Examples:
- `chapter = 103` — current writing position
- `lang = ja` — reader's language preference
- `activechars = [elara, mentor]` — characters in the current scene
- `mode = reader` — product context

The same preset definition produces different outputs for different variable inputs. A Japanese reader and an English reader resolve the same preset with different `lang` values and get different variant selections.

### 3.8 Resolution

Resolution is the process of walking a composition tree and producing flat markdown output. The resolution engine is a **pure function**:

**Input:** preset (rules + composition reference) + variables + access filter
**Output:** flat markdown string

Algorithm:
1. Evaluate rules against variables and document tags to produce a **selection map** (per-slot toggle states and per-variant-group sort orders).
2. The presentation layer may apply manual overrides on top of the selection map before passing it to the resolution walker.
3. Walk the composition tree using the final selection map:
   a. For each slot in order: if toggled off, skip.
   b. If the slot points to a document, resolve it (leaf → content, composition → recurse).
   c. If the slot points to a variant group, take the first accessible member per the sort order, then resolve that document.
4. Concatenate all emitted content in slot order.
5. Output as a single `.md` file.

### 3.9 Access Filter

The access filter is an injected dependency that determines which documents a given user can access. It is a function: `(document_id) → boolean`.

- **Power App**: returns `true` for all documents. No filtering.
- **Reader App**: returns `true` only for documents the reader has access to (based on tier, purchase status, etc.).

The resolution engine calls the access filter when selecting variant group members. If a member is inaccessible, it is skipped. The sort order and fallback logic guarantee that the universal default (position 0) is always accessible, so resolution never fails — it falls back to the default, which might be a paywall message.

---

## 4. User Personas

### 4.1 Novelist (Primary — Power App)

Writes long-form fiction (50–200+ chapters). Needs to maintain continuity across a massive body of work. Uses AI assistance for drafting, brainstorming, and continuity checking. Uses dynamic presets with rules to automatically assemble context that slides with the current writing position.

### 4.2 Fanfic Author (Power App + Reader App)

Works with existing source material. Creates variant chapters that diverge from the original. Maintains multiple storyline branches (fanfic A, fanfic B) that share most content and diverge on specific chapters. Distributes to readers via the Reader App, where each reader selects their preferred branch.

### 4.3 Worldbuilder (Power App)

Creates extensive lore documents — character profiles, location descriptions, magic systems, timelines. Needs multiple levels of detail (full profile vs. summary vs. one-liner) for different contexts. Tags documents by character, location, and relevance.

### 4.4 Translator (Power App + Reader App)

Maintains parallel language versions of the same work. Uses variant groups to hold translations. Reader App auto-selects language based on reader profile. Does not need to duplicate the composition structure per language — one composition, one preset with a `lang` sort rule, serves all languages.

### 4.5 Reader (Reader App)

Consumes published content. Experience is determined by access level (free/paid), language preference, and content branch (original/fanfic). Does not see the composition structure — only the resolved output. Variant selection happens automatically via the reader's profile variables and access filter.

---

## 5. Detailed Feature Requirements

### 5.1 Document Management

#### 5.1.1 Leaf Document

| Requirement | Description |
|---|---|
| F-DOC-001 | Create a new leaf document with a title and markdown content. |
| F-DOC-002 | Edit a leaf document's content using a markdown editor. |
| F-DOC-003 | Delete a leaf document. System must handle cascading: removal from variant groups, broken references in compositions flagged as errors. |
| F-DOC-004 | Support markdown rendering preview. |
| F-DOC-005 | Documents have an optional `alias` field (comma-separated) for search/autocomplete. |

#### 5.1.2 Composition Document

| Requirement | Description |
|---|---|
| F-COMP-001 | Create a new composition document with a title and an empty slot list. |
| F-COMP-002 | Add a slot to a composition. Slot can reference a document or a variant group. |
| F-COMP-003 | Reorder slots within a composition via drag-and-drop. |
| F-COMP-004 | Remove a slot from a composition. |
| F-COMP-005 | Resolve a composition into flat markdown output. |
| F-COMP-006 | Detect and display broken references (deleted documents, empty variant groups). |
| F-COMP-007 | Prevent circular references (composition A → composition B → composition A). |
| F-COMP-008 | Display a tree view of the composition's structure, showing resolved documents at each slot. |

### 5.2 Variant Group Management

| Requirement | Description |
|---|---|
| F-VAR-001 | Create a new variant group with a name. |
| F-VAR-002 | Add a document (leaf or composition) to a variant group. |
| F-VAR-003 | Remove a document from a variant group. |
| F-VAR-004 | Reorder documents within a variant group (first = default). |
| F-VAR-005 | **The first document (position 0) must be universally accessible.** Enforced as a constraint. The system prevents moving a non-universal document to position 0 or removing the universal document without replacement. |
| F-VAR-006 | Delete a variant group. Compositions referencing it will have broken references (flagged, not silently resolved). |
| F-VAR-007 | A variant group must contain only documents, never other variant groups. |
| F-VAR-008 | Display all compositions that reference a given variant group (reverse lookup). |

### 5.3 Tag System (Key-Value)

| Requirement | Description |
|---|---|
| F-TAG-001 | Tags are key-value pairs (e.g., `lang:ja`, `chapter:103`, `char:elara`). |
| F-TAG-002 | Tag keys are project-scoped. Tag values are free-form text. |
| F-TAG-003 | Apply one or more tags to any document. |
| F-TAG-004 | Search and filter documents by tag key, tag value, or key-value combination. |
| F-TAG-005 | Tags are the primary matching mechanism for preset rules. |

### 5.4 Preset (Dynamic)

| Requirement | Description |
|---|---|
| F-PRE-001 | Create a preset with a name and a reference to a composition. |
| F-PRE-002 | Define an ordered list of rules on the preset. Rules follow the `where <premise> do <action>` pattern. |
| F-PRE-003 | Premises support: variable comparisons (`var(name) = value`, `var(name) < value`, `var(name) not null`, `var(name) in [list]`), tag comparisons (`tag(key) = value`, `tag(key) < value`, `tag(key) not in var(list)`), and compound conditions (AND, OR, NOT). |
| F-PRE-004 | Actions support: `sort by [preference list]`, `toggle on`, `toggle off`, `select`. Sort preference lists can reference literal values and variable references. |
| F-PRE-005 | Rules are evaluated in order. Later rules override earlier rules on the same slot/member. |
| F-PRE-006 | Resolve a preset into a flat `.md` file given a set of runtime variables and an access filter. |
| F-PRE-007 | Display estimated token count for the resolved output. |
| F-PRE-008 | Export resolved preset to a `.md` file usable with any external AI client. |
| F-PRE-009 | A preset can reference ad-hoc documents directly (not only via a composition), for context inclusion outside the tree. |
| F-PRE-010 | A preset with zero rules behaves identically to a static preset — group defaults resolve everything. |

### 5.5 Variables (Presentation Layer)

| Requirement | Description |
|---|---|
| F-VAR-V-001 | Variables are name-value pairs passed to the resolution engine at resolution time. |
| F-VAR-V-002 | The Power App provides a UI for the author to set and adjust variables (e.g., a sidebar with `chapter = 103`). |
| F-VAR-V-003 | The Reader App derives variables from the reader's profile (e.g., `lang`, `tier`). |
| F-VAR-V-004 | Variables are presentation-layer state. The engine never stores or mutates them. |

### 5.6 Manual Overrides (Presentation Layer)

| Requirement | Description |
|---|---|
| F-MAN-001 | After rules evaluate and produce a selection map, the UI presents the result as a checklist of slots with toggle states and variant selections. |
| F-MAN-002 | The user can manually override any toggle or variant selection in the checklist. Manual overrides take final precedence. |
| F-MAN-003 | Manual override persistence is a UI/presentation concern. The engine does not store them. |

### 5.7 Level-of-Detail System

The LOD system is a consequence of the rule engine and tag system, not a separate feature.

| Requirement | Description |
|---|---|
| F-LOD-001 | Any document can have a summary variant — the variant group contains both the full version and a summarized version, distinguished by tags (e.g., `summary:chapter`, `summary:arc`). |
| F-LOD-002 | Dynamic preset rules automate LOD selection: `where tag(chapter) < var(current_chapter) sort by [summary:chapter, ...]` selects summaries for past chapters automatically. |
| F-LOD-003 | Hierarchical summarization (chapter → arc → volume) is achieved by layered rules operating at different tag levels. |
| F-LOD-004 | Support AI-assisted summary generation: given a document, generate a summary. The summary is stored as a new leaf document tagged appropriately and added to the variant group. |
| F-LOD-005 | Summaries at higher levels are generated from summaries at the level below, not from full text — keeping token cost bounded. |

### 5.8 Markdown Editor

| Requirement | Description |
|---|---|
| F-EDIT-001 | Full markdown editing with syntax highlighting. |
| F-EDIT-002 | Live preview (split-pane or toggle). |
| F-EDIT-003 | Extensible — supports plugins or custom syntax for future features. |
| F-EDIT-004 | Composition documents show a structural editor (slot list), not a text editor. |

### 5.9 Project Organization

| Requirement | Description |
|---|---|
| F-ORG-001 | All documents, variant groups, and presets exist within a project. |
| F-ORG-002 | Projects are isolated — no cross-project references. |
| F-ORG-003 | File browser / tree view showing all documents, compositions, variant groups, and presets. |
| F-ORG-004 | Search and filter documents by title, alias, and tags (key-value). |

---

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NF-001 | Resolution of a composition with 200+ chapters must complete in under 2 seconds. |
| NF-002 | The `.md` export must be a single, valid markdown file usable by any external tool. |
| NF-003 | Circular reference detection must be performed at composition edit time, not only at resolution time. |
| NF-004 | The system must gracefully handle broken references with clear error indicators, never silent data loss. |
| NF-005 | Token count estimation must be available before resolution to help users stay within AI context budgets. |
| NF-006 | The Power App must work offline (local-first). Cloud sync is a future consideration. |
| NF-007 | The logic layer must be fully separable from the presentation layer, with no UI state leaking into the engine. |
| NF-008 | The resolution engine must be a pure function: same inputs always produce the same output. |
| NF-009 | Rule evaluation for a preset with 20 rules over 200 slots must complete in under 500ms. |

---

## 7. Out of Scope (v1)

- Real-time collaboration / multiplayer editing.
- Built-in AI chat interface (the system produces `.md` context files; the user provides them to their own AI client).
- Auto-sync of resolved presets (on-demand resolution only).
- Git-style branching/merging of documents.
- Timeline / event management system.
- Publishing / export to EPUB, PDF, etc.
- Reader App payment processing (access tier data is assumed to be provided externally).

---

## 8. User Workflows

### 8.1 Setting Up a Novel (Power App)

1. Create a project.
2. Create leaf documents for each chapter. Tag them: `chapter:1`, `arc:1`, `volume:1`, etc.
3. Create variant groups where alternatives exist (e.g., "Chapter 3 Variants" containing "Chapter 3: Original" at position 0 and "Chapter 3: Fanfic A" tagged `fanfic:A`).
4. Create a composition document "Full Book" with one slot per chapter.
5. Resolve the composition to preview the full book as markdown.

### 8.2 Writing with AI Context — Dynamic Preset (Power App)

1. Create summary variants for each chapter. Tag summaries with `summary:chapter`.
2. Create arc and volume summaries. Tag with `summary:arc`, `summary:volume`.
3. Create a preset "Active Context" with rules:
   - `where tag(char) not in var(activechars) do toggle off`
   - `where tag(volume) < var(current_volume) do sort by [summary:volume, ...]`
   - `where tag(arc) < var(current_arc) do sort by [summary:arc, ...]`
   - `where tag(chapter) < var(current_chapter) do sort by [summary:chapter, ...]`
4. Set variables: `current_chapter = 103`, `current_arc = 15`, `current_volume = 3`, `activechars = [elara, mentor]`.
5. Rules evaluate. UI presents the resulting checklist. Adjust manually if needed.
6. Resolve to `.md`. Drop into AI client.

### 8.3 Moving to the Next Chapter (Power App)

1. Change variable `current_chapter` from 103 to 104. Update `activechars` if needed.
2. Rules re-evaluate automatically. Context window slides.
3. Re-resolve. Done.

### 8.4 Creating a Fanfic Branch (Power App)

1. Write new leaf documents for the chapters that diverge. Tag them `fanfic:B`.
2. Add them to the existing variant groups for those chapters.
3. Create a preset with rule: `where true sort by [fanfic:B, fanfic:A, ...]`.
4. For chapters where fanfic B has no variant, sort falls through to fanfic A, then to original.
5. No duplication of the composition structure.

### 8.5 Translation Workflow (Power App)

1. Write translated leaf documents. Tag them `lang:ja`, `lang:en`, etc.
2. Add translations to the chapter's variant group. Original language at position 0 (universal default).
3. Add a secondary sort rule to any preset: `where var(lang) not null sort by tag(lang) matching var(lang)`.
4. Set `lang = ja` → Japanese versions selected where available, fallback to original.

### 8.6 Reader Experience (Reader App)

1. Reader opens the app. Profile provides variables: `lang = ja`, `tier = premium`, `fanfic_pref = B`.
2. Reader navigates to a chapter. The Reader App resolves the preset with the reader's variables and access filter.
3. Access filter: premium documents accessible. Free documents accessible. Locked documents inaccessible — resolution falls back to position 0 default (paywall placeholder).
4. Sort rules select Japanese fanfic B where available, fallback chain handles gaps.
5. Reader sees resolved content. No composition structure exposed.

---

## 9. Success Metrics

| Metric | Target |
|---|---|
| Time to assemble AI context for a 200-chapter novel (with dynamic preset) | Under 5 seconds (set variables, resolve) |
| Context accuracy | Zero irrelevant documents in the resolved output |
| Chapter transition | Change one variable, re-resolve. Under 3 seconds. |
| Resolution correctness | Resolved output matches the exact rule evaluation + manual overrides with no missing or duplicated content |
| Reader variant accuracy | Correct language/tier/branch variant served for 100% of readers |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Deep recursion in composition trees causes performance issues | Slow resolution | Set a maximum recursion depth (e.g., 20 levels). Validate at edit time. |
| Users forget to create summaries, making LOD rules ineffective | Poor AI context quality | Surface "missing summary" warnings in the preset UI. Offer one-click AI summary generation. |
| Variant group deletion breaks multiple compositions silently | Data integrity | Broken references are explicit errors shown in the UI. Require confirmation listing all affected compositions. |
| Token count estimation is inaccurate | User exceeds AI context limits | Use a conservative estimation model. Show both estimated and hard limit clearly. |
| Rule complexity becomes hard to debug | User confusion | Provide a "rule evaluation trace" in the Power App UI showing which rule affected which slot. |
| Universal default convention violated | Reader sees broken content | Enforce position 0 accessibility as a constraint, not just a convention. |
| Variable-tag mismatch (rule references tag key that doesn't exist) | Silent no-op | Rules that match zero slots/members produce a warning in the UI. |
