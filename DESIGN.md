# Design Document

## Extendable Markdown Editor — Technical Architecture and System Design

---

## 1. Architectural Overview

### 1.1 Design Philosophy

The system is built on four principles:

1. **Documents are atoms.** Every piece of content is a leaf document. Compositions and presets are structural — they reference documents but never contain content themselves. This eliminates the dual-identity problem where a single entity is both content and container.

2. **Structure is explicit, not embedded.** Compositions are defined by slot lists, not by parsing syntax from document bodies. No `{{handlebar}}` templates. No string interpolation. Structural relationships live in dedicated tables, not in content fields.

3. **Resolution is on-demand, stateless, and portable.** The system never maintains a cached "resolved" state. Every resolution walks the tree fresh. Output is always a flat `.md` file — the universal interchange format. The resolution engine is a pure function: same inputs always produce the same output.

4. **Logic and presentation are separated.** The engine owns data, rules, and resolution. The presentation layer owns variables, manual overrides, and user state. The engine has no knowledge of which product it serves (Power App or Reader App).

### 1.2 Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Presentation Layer                          │
│            (Product-specific, stateful)                      │
│                                                              │
│  ┌─────────────────────┐   ┌──────────────────────────────┐ │
│  │     Power App        │   │        Reader App             │ │
│  │  (Desktop, Local)    │   │    (Web / Mobile, Served)     │ │
│  │                      │   │                               │ │
│  │  - Variable sidebar  │   │  - User profile → variables   │ │
│  │  - Manual overrides  │   │  - Access filter from tier    │ │
│  │  - Author editing    │   │  - Read-only content view     │ │
│  │  - Override persist  │   │  - No composition exposure    │ │
│  └──────────┬───────────┘   └──────────────┬────────────────┘ │
│             │                               │                 │
│             └───────────┬───────────────────┘                 │
│                         │                                     │
│              variables + selection_map + access_filter         │
│                         │                                     │
│                         ▼                                     │
├─────────────────────────────────────────────────────────────┤
│                    Logic Layer (Engine)                       │
│              (Product-agnostic, stateless)                    │
│                                                              │
│  ┌────────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │  Rule Evaluator │ │  Resolution   │ │  Cycle Detection   │ │
│  │                 │ │   Walker      │ │  & Validation      │ │
│  └────────┬────────┘ └──────┬───────┘ └────────────────────┘ │
│           │                 │                                 │
│           └─────────┬───────┘                                 │
│                     │                                         │
│              ┌──────┴──────┐                                  │
│              │ Data Provider │ ← interface, not implementation │
│              │  (injected)  │                                  │
│              └──────┬──────┘                                  │
│                     │                                         │
└─────────────────────┼─────────────────────────────────────────┘
                      │
               ┌──────┴──────┐
               │   Storage    │
               │  (SQLite /   │
               │   Postgres)  │
               └─────────────┘
```

### 1.3 Product Summary

| | Power App | Reader App |
|---|---|---|
| **Platform** | Desktop (local-first) | Web or mobile |
| **User** | Author | Reader |
| **Data provider** | Returns all documents | Filters by access level |
| **Variables** | Set manually by author in UI | Derived from reader profile |
| **Manual overrides** | Full control, persisted locally | Not exposed |
| **Composition structure** | Visible, editable | Hidden |
| **Access filter** | `() → true` (all access) | Per-reader access check |

### 1.4 Technology Decisions (Deferred)

This design document is **implementation-agnostic**. Specific technology choices (React vs. Svelte, SQLite vs. Postgres, Tauri vs. Electron, etc.) are deferred to the implementation phase.

Key constraints that will influence technology selection:
- Must support recursive tree traversal with cycle detection.
- Must support ordered lists with reorderable entries.
- Must support full-text search across document titles, aliases, and content.
- Must support key-value tag matching with comparison operators.
- Power App: should support offline-first operation (v1 requirement).
- Reader App: should support server-side resolution for content delivery.

---

## 2. Core Data Model

### 2.1 Entity Summary

| Entity | Purpose | Layer | Key Relationships |
|---|---|---|---|
| **Project** | Top-level isolation boundary | Engine | Contains all other entities |
| **Document** | Content unit (leaf) or structural assembly (composition) | Engine | Referenced by slots, variant groups, presets |
| **Composition Slot** | Ordered position in a composition | Engine | Points to a document or variant group |
| **Variant Group** | Named set of interchangeable documents | Engine | Contains documents via membership table |
| **Variant Group Member** | Join: document ↔ variant group | Engine | Ordered, first = universal default |
| **Preset** | Named configuration: composition reference + rules | Engine | References a composition, has rules |
| **Preset Rule** | Ordered `where/do` rule within a preset | Engine | Defines premise + action |
| **Preset Ad-Hoc Document** | Extra documents appended to a preset | Engine | References a document |
| **Tag** | Key-value organizational label | Engine | Applied to documents via join table |
| **Document History** | Immutable snapshots | Engine | Records every document change |
| **Variables** | Runtime name-value pairs | Presentation | Passed to engine at resolution time |
| **Manual Overrides** | User adjustments to the selection map | Presentation | Applied after rule evaluation, before tree walking |

### 2.2 Document Duality: Leaf vs. Composition

The `is_composition` boolean on the document table is the single source of truth for document kind. Enforced at the database level:

- `is_composition = FALSE` → leaf. Has `content` (text, possibly empty). No slots.
- `is_composition = TRUE` → composition. `content` must be NULL. Has slots.

**Converting between types:** A leaf can be promoted to a composition (content is cleared, user must confirm). A composition can be demoted to a leaf (slots are deleted, user provides content). This is a destructive operation in both directions and requires explicit confirmation.

### 2.3 Variant Group Independence

Variant groups are **not documents**. They have no `content`, no `is_composition`, no place in the composition tree except as a reference target.

Consequences:
- Deleting a variant group does not delete its member documents. It only removes the group entity and its memberships. Composition slots that referenced the group become broken references.
- Deleting a document that belongs to a variant group removes it from the group. If the group becomes empty, compositions referencing it will flag a "no available options" error.
- A document can belong to multiple variant groups (e.g., "Chapter 3: Summary" can be in both "Chapter 3 Variants" and "Summary Variants").

### 2.4 Universal Default Constraint

The first member (position 0) of every variant group must be universally accessible — it is the fallback for any reader or context that cannot access other members. This is enforced as a constraint:

- The system prevents reordering a non-universal document to position 0 without confirmation.
- The system prevents removing the position 0 document without a replacement.
- For paid/gated content, the default is typically a paywall placeholder (e.g., "Please unlock this chapter to read").
- For translations, the default is the original language.

This eliminates the need for special-case error handling in the resolution engine. The engine never encounters an empty-access variant group because the default is always reachable.

---

## 3. Composition System

### 3.1 Slot Model

A composition's structure is defined entirely by its slots. There is no "body" or "template" to parse.

```
Composition "Full Book"
├── Slot 0: Document → "Foreword" (leaf)
├── Slot 1: Variant Group → "Chapter 1 Variants"
├── Slot 2: Variant Group → "Chapter 2 Variants"
├── Slot 3: Document → "Interlude" (leaf)
├── Slot 4: Document → "Arc 2 Composition" (composition → recurse)
└── Slot 5: Variant Group → "Epilogue Variants"
```

**Note:** Slots no longer carry a `selected_document_id`. Variant selection is determined entirely by preset rules and the presentation layer, not stored on the slot.

### 3.2 Slot Operations

| Operation | Behavior |
|---|---|
| **Add slot** | Appends to end or inserts at position. Validates no circular reference. |
| **Remove slot** | Removes from list. Remaining slots reorder to fill gap. |
| **Reorder slots** | Drag-and-drop. Updates `slot_order` values. |
| **Change slot target** | Swap a slot's reference between documents and variant groups. Validates no circular reference. |

### 3.3 Circular Reference Prevention

Cycles are detected **at write time** — when a slot is added or its reference is changed. The detection algorithm traverses the target document's entire subtree (following both direct document references and variant group memberships) looking for the composition being edited.

**Edge cases:**
- A variant group containing both composition A and composition B, where A references B, is **not** a cycle. The cycle only exists if the chain loops back to the *composition being edited*.
- Changing a variant group's membership (adding a composition to a group) must also trigger cycle detection for every composition that references that group.

### 3.4 Broken References

A broken reference occurs when:
- A slot's `ref_document_id` points to a deleted document.
- A slot's `ref_variant_group_id` points to a deleted variant group.
- A variant group referenced by a slot has zero members.

Broken references are **surfaced explicitly**:
- In the composition builder UI, broken slots are visually marked (red border, warning icon).
- During resolution, broken slots are skipped (the walker continues with the next slot).
- A composition with broken references can still be partially resolved.

---

## 4. Variant System

### 4.1 Variant Group Lifecycle

```
Create group "Chapter 3 Variants"
    → Empty group (valid but useless)

Add "Chapter 3: Original" (leaf)
    → Group has 1 member (this is the universal default at position 0)

Add "Chapter 3: Fanfic A" (leaf, tagged fanfic:A)
    → Group has 2 members

Add "Chapter 3: Japanese" (leaf, tagged lang:ja)
    → Group has 3 members

Remove "Chapter 3: Original"
    → System prompts for new universal default before allowing removal

Delete the group
    → All documents survive (they are independent entities)
    → All composition slots referencing this group become broken references
```

### 4.2 Variant Use Cases

Variant groups are semantically neutral — they are dumb containers. The **tags** on member documents carry the meaning. The same variant group can hold members differentiated by any dimension:

| Dimension | Tag Key | Example Members | Selection Mechanism |
|---|---|---|---|
| Level of detail | `summary` | Full, Chapter Summary, Arc Summary | Rule: `sort by [summary:chapter, ...]` |
| Language | `lang` | English, Japanese, Spanish | Rule: `sort by tag(lang) matching var(lang)` |
| Storyline branch | `fanfic` | Original, Fanfic A, Fanfic B | Rule: `sort by [fanfic:B, fanfic:A, ...]` |
| Access tier | `tier` | Free placeholder, Premium full | Access filter + universal default fallback |
| Tone/style | `tone` | Darker ending, Happy ending | Preset-specific sort or manual selection |

### 4.3 Level-of-Detail Pattern

The variant system enables hierarchical summarization without any special LOD-specific code:

```
Variant Group: "Chapter 1 Variants"
├── 0: "Chapter 1: Full" (leaf, 5000 tokens)
└── 1: "Chapter 1: Summary" (leaf, 200 tokens, tagged summary:chapter)

Variant Group: "Arc 1 Variants"
├── 0: "Arc 1: Full Composition" (composition → contains Chapter 1-10 slots)
└── 1: "Arc 1: Summary" (leaf, 500 tokens, tagged summary:arc)

Variant Group: "Volume 1 Variants"
├── 0: "Volume 1: Full Composition" (composition → contains Arc 1-5 slots)
└── 1: "Volume 1: Summary" (leaf, 300 tokens, tagged summary:volume)
```

With a dynamic preset, LOD selection is automatic:

```
Rule 1: where tag(volume) < var(current_volume) do sort by [summary:volume, ...]
Rule 2: where tag(arc) < var(current_arc) do sort by [summary:arc, ...]
Rule 3: where tag(chapter) < var(current_chapter) do sort by [summary:chapter, ...]
```

Set `current_chapter = 103`, `current_arc = 15`, `current_volume = 3` → the context window is automatically assembled with the right level of detail at every distance.

### 4.4 Summary Generation Workflow

Summaries are created bottom-up, each level consuming only the level below:

1. **Chapter summary** — AI receives the full chapter leaf document. Produces a summary leaf. Summary is tagged `summary:chapter` and added to the chapter's variant group.
2. **Arc summary** — AI receives all chapter summaries in the arc. Produces an arc summary leaf. Tagged `summary:arc`, added to the arc's variant group.
3. **Volume summary** — AI receives all arc summaries. Produces a volume summary leaf. Tagged `summary:volume`, added to the volume's variant group.

Token cost at each level is bounded: generating an arc summary for 10 chapters requires ~2,000 tokens of input (10 × 200-token chapter summaries), not the ~50,000 tokens of full chapter text.

### 4.5 Fanfic Branch Pattern

A fanfic branch only needs to contain the chapters that diverge. The rest falls through:

```
Preset "Fanfic B Reader" rules:
    Rule 1: where true do sort by [fanfic:B, fanfic:A, ...]
    Rule 2: where var(lang) not null do sort by tag(lang) matching var(lang)
```

For a 200-chapter novel where Fanfic B diverges on 5 chapters:
- Those 5 chapters have a member tagged `fanfic:B` → selected first.
- The other 195 chapters have no `fanfic:B` member → sort falls through to `fanfic:A`, then to the original at position 0.
- If `lang = ja`, the secondary sort picks Japanese translations where available.

No duplication of the composition structure. One composition serves all branches.

---

## 5. Rule Engine

### 5.1 Rule Structure

Each rule has three components:

```
where <premise> do <action>
```

**Premise**: A condition tree (see ERD for JSON schema). Can reference variables (global evaluation) or document tags (per-slot/per-member evaluation).

**Action**: One of `sort_by`, `toggle_on`, `toggle_off`, `select`.

**Evaluation order**: Rules are evaluated in `rule_order` sequence. Later rules override earlier ones on the same slot/member.

### 5.2 Premise Evaluation

Two evaluation modes:

| Premise Type | Evaluation Scope | Example |
|---|---|---|
| Variable-only | Global — once per rule, true or false for all slots | `where var(mode) = reader` |
| Tag-referencing | Per-entity — evaluated against each slot's document or each variant group member | `where tag(chapter) < 103` |

Variable-only premises are a fast path: if false, the entire rule is skipped. If true, the action applies to all matching slots.

### 5.3 Action Semantics

**`sort_by`**: Reorders variant group members by a preference list. The preference list is an ordered set of tag key:value pairs. Members matching the first preference sort highest. Supports secondary sort keys. After sorting, the first **accessible** member (per access filter) is selected.

**`toggle_off`**: Marks matching slots as disabled. They are skipped during tree walking.

**`toggle_on`**: Marks matching slots as enabled. Used to override a prior `toggle_off` for a subset of slots.

**`select`**: Hard-selects a variant by tag match. Equivalent to `sort_by` with a single preference. Overrides any prior sort on the same slot.

### 5.4 Rule Evaluation Output

Rule evaluation produces a **selection map**:

```
SelectionMap = {
    toggle_states: Map<slot_id, boolean>       // ON or OFF per slot
    sort_orders: Map<slot_id, List<document_id>> // ordered member list per variant group slot
}
```

This selection map is the contract between the rule engine and the resolution walker. The presentation layer can mutate this map (manual overrides) before passing it to the walker. The walker has no knowledge of rules — it only reads the selection map.

### 5.5 Example Rule Set: Power App RAG Context

```
Preset: "Active Context"
Composition: "Full Novel"

Rule 0: where tag(char) not in var(activechars) do toggle off
Rule 1: where tag(volume) < var(current_volume) do sort by [summary:volume, ...]
Rule 2: where tag(arc) < var(current_arc) do sort by [summary:arc, ...]
Rule 3: where tag(chapter) < var(current_chapter) do sort by [summary:chapter, ...]

Variables: { current_chapter: 103, current_arc: 15, current_volume: 3, activechars: [elara, mentor] }
Access filter: () → true

Result:
- Character profiles not involving elara or mentor: toggled off
- Volumes 1-2: summary variant selected
- Arcs 1-14: summary variant selected
- Chapters 1-102: summary variant selected
- Chapter 103+: full variant (no rule matched, default)
```

### 5.6 Example Rule Set: Reader App

```
Preset: "Reader Default"
Composition: "Full Novel"

Rule 0: where true do sort by [fanfic:B, fanfic:A, ...]
Rule 1: where var(lang) not null do sort by tag(lang) matching var(lang)

Variables: { lang: "ja", tier: "premium" }
Access filter: (doc_id) → check_reader_access(reader_id, doc_id)

Result:
- Each chapter: Fanfic B Japanese variant if accessible, else Fanfic B original, else Fanfic A Japanese, etc.
- Inaccessible variants skipped, falls back to universal default (position 0)
```

---

## 6. Resolution Engine

### 6.1 Engine Interface

```
function resolve(preset_id, variables, access_filter, manual_overrides?) → ResolvedOutput

ResolvedOutput = {
    content: string           // flat markdown
    errors: List<string>      // broken references, depth exceeded, etc.
    token_estimate: int       // character_count / 4
}
```

The engine does three things in order:
1. **Evaluate rules** → produce selection map
2. **Apply manual overrides** (if provided) → mutate selection map
3. **Walk tree** using final selection map → produce markdown

### 6.2 Composition Resolution (Tree Walk)

```
function resolve_tree(node_id, selection_map, access_filter, depth=0, max_depth=20):
    if depth >= max_depth:
        return "[ERROR: Maximum recursion depth exceeded]"

    document = fetch_document(node_id)
    if document is NULL:
        return "[ERROR: Document not found]"

    // LEAF — return content
    if not document.is_composition:
        return document.content ?? ""

    // COMPOSITION — walk slots
    parts = []
    slots = fetch_slots(document.id) ordered by slot_order

    for slot in slots:
        // Check toggle state from selection map
        if selection_map.toggle_states.get(slot.id) == OFF:
            continue

        // Resolve slot to a document ID
        target_id = NULL

        if slot.ref_type == 'document':
            target_id = slot.ref_document_id

        else if slot.ref_type == 'variant_group':
            sorted_members = selection_map.sort_orders.get(slot.id)
            if sorted_members and len(sorted_members) > 0:
                // First accessible member per sort order
                for member_id in sorted_members:
                    if access_filter(member_id):
                        target_id = member_id
                        break
            
            if target_id is NULL:
                // Fallback to universal default (position 0, guaranteed accessible)
                target_id = get_first_member(slot.ref_variant_group_id)

        if target_id is NULL:
            continue  // broken reference, skip

        parts.append(resolve_tree(target_id, selection_map, access_filter, depth + 1, max_depth))

    return join(parts, "\n\n")
```

### 6.3 Output Format

The resolved output is a single markdown string. No metadata, no structural markers, no slot boundaries — just the concatenated prose in slot order, separated by double newlines.

For AI context use, the preset name and a timestamp are prepended as a markdown comment:

```markdown
<!-- Resolved from preset "Active Context" at 2026-03-14T10:30:00Z -->
<!-- Variables: current_chapter=103, current_arc=15, current_volume=3 -->

[Volume 1 summary content...]

[Arc 13 summary content...]

...

[Full Chapter 103 content...]

[Character Profile: Elara content...]
```

### 6.4 Performance Characteristics

| Scenario | Expected Behavior |
|---|---|
| 200-chapter novel, all leaves, 10 rules | Rule evaluation: <200ms. Tree walk: sub-second. Total: under 2 seconds. |
| 200-chapter novel, 5 levels of nesting | ~250 DB reads. Under 2 seconds. |
| Deeply nested recursive compositions (20 levels) | Hits max_depth safety limit. Returns partial output + error. |
| Broken references scattered through tree | Resolves all valid slots, skips broken ones. Never crashes. |

### 6.5 Caching Strategy

No persistent cache. Resolution is always fresh. However, two optimizations are appropriate:

1. **Batch fetch** — instead of fetching one document per recursion step, pre-fetch all documents in the project into memory before resolution. For a 200-chapter novel, this is one query returning ~200 rows.
2. **Token count memoization** — during preset editing, cache the token count per resolved slot. Invalidate when the underlying document's `updated_at` changes.

---

## 7. Data Provider Interface

The resolution engine does not query storage directly. It uses an injected **data provider** interface. This is the seam between the engine and the two products.

### 7.1 Interface Definition

```
interface DataProvider:
    fetch_document(id) → Document | null
    fetch_slots(composition_id) → List<CompositionSlot>
    get_variant_group_members(group_id) → List<VariantGroupMember>
    get_first_member(group_id) → document_id | null
    get_document_tags(document_id) → List<Tag>
    get_preset(preset_id) → Preset
    get_preset_rules(preset_id) → List<PresetRule>
    get_preset_adhoc_documents(preset_id) → List<PresetAdhocDocument>
```

### 7.2 Implementations

**Power App Data Provider:**
- Reads from local SQLite.
- No filtering. All documents returned.
- `fetch_document(id)` always returns the document if it exists.

**Reader App Data Provider:**
- Reads from server-side database (Postgres or equivalent).
- Wraps all document retrieval with access-level filtering.
- `get_variant_group_members(group_id)` returns only members the reader can access, **plus the universal default at position 0** (always included).

The access filter is separate from the data provider — it's passed to the resolution engine as a function. The data provider handles storage; the access filter handles authorization. They compose at the engine boundary.

---

## 8. UI Architecture (Power App)

### 8.1 Primary Views

| View | Purpose |
|---|---|
| **Project Browser** | File tree showing all documents, variant groups, and presets. Supports search, filter by tag (key-value). |
| **Leaf Editor** | Markdown editor with live preview. Standard editing experience. |
| **Composition Builder** | Slot list editor. Drag-and-drop reordering. Slot cards show reference type and target name. Broken references highlighted. |
| **Variant Group Manager** | Member list with ordering. Shows all compositions that reference this group (reverse lookup). |
| **Preset Configurator** | Rule editor + variable inputs + resolved checklist with manual overrides + token budget bar + resolve button. |
| **Resolved Preview** | Read-only markdown renderer showing the resolved output. |
| **Rule Evaluation Trace** | Debug view showing which rule affected which slot and why. |

### 8.2 Project Browser Structure

```
📁 My Novel
├── 📄 Foreword                          (leaf)
├── 📄 Full Book                         (composition)
├── 📂 Variant Groups
│   ├── 🔀 Chapter 1 Variants
│   │   ├── 📄 Chapter 1: Full           (lang:en)
│   │   ├── 📄 Chapter 1: Japanese       (lang:ja)
│   │   └── 📄 Chapter 1: Summary        (summary:chapter)
│   ├── 🔀 Chapter 2 Variants
│   │   ├── 📄 Chapter 2: Full
│   │   └── 📄 Chapter 2: Summary        (summary:chapter)
│   └── 🔀 Chapter 3 Variants
│       ├── 📄 Chapter 3: Original
│       ├── 📄 Chapter 3: Fanfic A       (fanfic:A)
│       ├── 📄 Chapter 3: Fanfic B       (fanfic:B)
│       └── 📄 Chapter 3: Summary        (summary:chapter)
├── 📂 Characters
│   ├── 📄 Elara: Full Profile           (char:elara)
│   ├── 📄 Elara: Summary                (char:elara, summary:character)
│   └── 📄 Mentor: Full Profile          (char:mentor)
├── 📂 Presets
│   ├── ⚙️ Active Context               (rules: LOD + char filter)
│   ├── ⚙️ Fanfic B Reader              (rules: fanfic sort + lang sort)
│   └── ⚙️ Full Book Export             (no rules, defaults only)
└── 🏷️ Tags
    ├── lang: en, ja
    ├── fanfic: A, B
    ├── summary: chapter, arc, volume
    ├── char: elara, mentor
    ├── chapter: 1, 2, 3, ...
    ├── arc: 1, 2, ...
    └── volume: 1, 2, ...
```

Note: The folder structure in the browser is purely organizational (UI-level grouping). It has no bearing on the data model.

### 8.3 Composition Builder UI

```
┌─ Full Book (Composition) ─────────────────────────────┐
│                                                        │
│  Slots:                                                │
│                                                        │
│  ┌─ 0 ──────────────────────────────────────────────┐  │
│  │ 📄 Foreword                              [⋮] [✕] │  │
│  │    Direct reference → leaf                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ 1 ──────────────────────────────────────────────┐  │
│  │ 🔀 Chapter 1 Variants                   [⋮] [✕] │  │
│  │    3 members: Full | Japanese | Summary           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ 2 ──────────────────────────────────────────────┐  │
│  │ 🔀 Chapter 2 Variants                   [⋮] [✕] │  │
│  │    2 members: Full | Summary                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ 3 ──────────────────────────────────────────────┐  │
│  │ ⚠️ Chapter 3 Variants                   [⋮] [✕] │  │
│  │    ERROR: Variant group deleted                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [ + Add Slot ]                                        │
│                                                        │
│  [ Preview Resolved Output ]                           │
└────────────────────────────────────────────────────────┘
```

### 8.4 Variant Group Manager UI

```
┌─ Chapter 3 Variants ──────────────────────────────────┐
│                                                        │
│  Members (drag to reorder, first = universal default): │
│                                                        │
│  1. 📄 Chapter 3: Original    🔒 universal default    │
│     Tags: chapter:3                                    │
│  2. 📄 Chapter 3: Fanfic A    (4.2k tok)              │
│     Tags: chapter:3, fanfic:A                          │
│  3. 📄 Chapter 3: Fanfic B    (3.8k tok)              │
│     Tags: chapter:3, fanfic:B                          │
│  4. 📄 Chapter 3: Summary     (180 tok)               │
│     Tags: chapter:3, summary:chapter                   │
│                                                        │
│  [ + Add Document ]                                    │
│                                                        │
│  ── Referenced by ──                                   │
│  📄 Full Book → Slot 3                                 │
│  📄 Arc 1 Composition → Slot 2                         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 8.5 Preset Configurator UI

```
┌─ Active Context ───────────────────────────────────────┐
│                                                        │
│  Composition: Full Novel                               │
│                                                        │
│  ── Rules ──                                           │
│  1. where tag(char) not in var(activechars)             │
│     do toggle off                                      │
│  2. where tag(volume) < var(current_volume)             │
│     do sort by [summary:volume, ...]                   │
│  3. where tag(arc) < var(current_arc)                   │
│     do sort by [summary:arc, ...]                      │
│  4. where tag(chapter) < var(current_chapter)           │
│     do sort by [summary:chapter, ...]                  │
│  [ + Add Rule ]                                        │
│                                                        │
│  ── Variables ──                                       │
│  current_chapter: [103]  current_arc: [15]             │
│  current_volume: [3]     activechars: [elara, mentor]  │
│                                                        │
│  ── Resolved Checklist (after rule evaluation) ──      │
│                                                        │
│  Budget: 15,000 tokens                                 │
│  Estimated: 12,340 tokens  [████████████░░░░] 82%      │
│                                                        │
│  ☑ Volume 1: Summary              ~300 tok   (rule 2)  │
│  ☑ Volume 2: Summary              ~280 tok   (rule 2)  │
│  ☑ Arc 13: Summary                ~500 tok   (rule 3)  │
│  ☑ Arc 14: Summary                ~520 tok   (rule 3)  │
│  ☑ Chapter 100: Summary           ~200 tok   (rule 4)  │
│  ☑ Chapter 101: Summary           ~210 tok   (rule 4)  │
│  ☑ Chapter 102: Summary           ~200 tok   (rule 4)  │
│  ☑ Chapter 103: Full              ~5,200 tok (default)  │
│  ☐ Mentor: Full Profile           (rule 1: off)        │
│  ☑ Elara: Full Profile            ~1,800 tok           │
│  ...                                                   │
│  ── Ad-Hoc ──                                          │
│  ☑ Chapter 103 Outline            ~330 tok             │
│                                                        │
│  Any checkbox can be manually toggled to override.      │
│  Any variant selection can be manually changed.         │
│                                                        │
│  [ Resolve to .md ]                                    │
└────────────────────────────────────────────────────────┘
```

The "(rule N)" annotations come from the rule evaluation trace, showing which rule determined each slot's state.

---

## 9. Export and Portability

### 9.1 .md Export

The primary export format is a single `.md` file. This is the output of resolving a composition or preset. The file is:
- Valid markdown.
- Self-contained (no external references).
- Usable by any tool that reads markdown files.
- Specifically designed to be dropped into AI chat interfaces as context.

### 9.2 Export Behavior

| Source | Export Behavior |
|---|---|
| Leaf document | Exports its content directly as `.md`. |
| Composition | Resolves all slots with default variant selections, concatenates, exports. |
| Preset | Evaluates rules with provided variables and access filter, applies manual overrides, resolves, appends ad-hoc documents, exports. |

### 9.3 File Naming

Default filename: `{preset_name}_{timestamp}.md` or `{composition_title}_{timestamp}.md`.

User can configure a custom filename pattern per preset.

---

## 10. Document History

### 10.1 What Gets Tracked

Every mutation to a document creates an immutable history entry:

| Event | Tracked Fields |
|---|---|
| Create document | Full initial state |
| Edit content | New content snapshot |
| Change title | New title |
| Convert leaf ↔ composition | New `is_composition` state |

### 10.2 What Does NOT Get Tracked

- Composition slot changes (slots are separate entities with their own lifecycle).
- Variant group membership changes.
- Preset rule changes.
- Tag assignments.

These are structural operations on relationships, not document content. They can be tracked in a separate audit log if needed, but are not part of the document history rollback system.

### 10.3 Rollback

Rolling back a document restores its content/title to a historical snapshot. It does **not** restore slot configurations, variant group memberships, or preset states. Rollback creates a new history entry ("rolled back to version from {timestamp}").

---

## 11. Extensibility Points

### 11.1 Plugin Architecture (Future)

| Extension Point | Description |
|---|---|
| **Custom document types** | Beyond leaf and composition, plugins could define new document types with custom editors. |
| **Custom resolution hooks** | Plugins could transform content during resolution (e.g., variable substitution in content, conditional sections). |
| **Custom export formats** | Beyond `.md`, plugins could export to EPUB, PDF, HTML, etc. |
| **AI provider integrations** | Built-in AI summary generation using configurable providers. |
| **Custom metadata fields** | User-defined fields on documents beyond title, alias, and tags. |
| **Custom rule actions** | New action types beyond sort/toggle/select. |
| **Custom premise operators** | New comparison operators for rule premises. |

### 11.2 API-First Design

All operations (CRUD, rule evaluation, resolution, export) are exposed as a clean internal API layer via the data provider interface. This enables:
- Power App (desktop) and Reader App (web/mobile) to share the same engine.
- Future web/server deployment.
- Scripting and automation.
- Third-party integrations.
- Testing in isolation from the UI.

---

## 12. Glossary

| Term | Definition |
|---|---|
| **Leaf** | A document with markdown content and no structural children. |
| **Composition** | A document with an ordered list of slots and no content. |
| **Slot** | A position in a composition, referencing either a document or a variant group. |
| **Variant Group** | A named, ordered set of interchangeable documents. Not a document itself. |
| **Universal Default** | The first member of a variant group (position 0). Must be accessible to all users. The fallback when no other member is accessible or selected. |
| **Tag** | A key-value pair applied to a document, used for organization and rule matching. |
| **Preset** | A named configuration consisting of a composition reference, an ordered list of rules, and optional ad-hoc documents. |
| **Rule** | A `where <premise> do <action>` statement within a preset. Evaluated in order to produce a selection map. |
| **Premise** | The condition part of a rule. Can reference variables (global evaluation) or document tags (per-entity evaluation). |
| **Action** | The effect part of a rule: sort_by, toggle_on, toggle_off, or select. |
| **Variable** | A name-value pair provided at resolution time by the presentation layer. Not stored by the engine. |
| **Selection Map** | The output of rule evaluation: per-slot toggle states and per-variant-group sort orders. The contract between the rule engine and the resolution walker. |
| **Access Filter** | An injected function `(document_id) → boolean` that determines document visibility per user/context. |
| **Resolution** | The process of evaluating rules, walking a composition tree, and producing flat markdown output. |
| **Broken Reference** | A slot pointing to a deleted document or empty variant group. Surfaced as an explicit error, skipped during resolution. |
| **Token Budget** | User-defined limit on the estimated token count of a resolved preset. Informational, not enforced. |
| **Level of Detail (LOD)** | The practice of maintaining summary variants and using rules to auto-select the right detail level. A consequence of the rule engine, not a separate system. |
| **Active Context** | A preset configured with rules that auto-adjust based on the author's current writing position. |
| **Logic Layer** | The engine: data model, rule evaluator, resolution walker, cycle detection. Stateless, product-agnostic. |
| **Presentation Layer** | The UI: variable management, manual overrides, user state persistence. Product-specific. |
| **Power App** | Desktop application for authors. Full authoring and RAG context composition. |
| **Reader App** | Web/mobile application for readers. Access-gated, auto-resolved content delivery. |
