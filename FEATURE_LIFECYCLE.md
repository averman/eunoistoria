# Feature Lifecycle

## Extendable Markdown Editor — From Idea to Merge

---

## 1. Pipeline Overview

```
  Owner              Dev Agent           Review Agent          Owner
    │                    │                    │                   │
    │  1. Task Spec      │                    │                   │
    ├───────────────────►│                    │                   │
    │                    │                    │                   │
    │                    │ 2. Load context    │                   │
    │                    │ 3. Review gate     │                   │
    │  4. Approve/adjust │    (if needed)     │                   │
    │◄───────────────────┤                    │                   │
    ├───────────────────►│                    │                   │
    │                    │                    │                   │
    │                    │ 5. Implement       │                   │
    │                    │ 6. Test            │                   │
    │                    │ 7. Completion      │                   │
    │                    │    artifact        │                   │
    │                    ├───────────────────►│                   │
    │                    │                    │                   │
    │                    │                    │ 8. Review diff    │
    │                    │                    │ 9. Review artifact│
    │                    │                    │ 10. Review report │
    │                    │                    ├──────────────────►│
    │                    │                    │                   │
    │                    │                    │     11. Approve / │
    │                    │                    │     Request changes│
    │                    │                    │                   │
```

---

## 2. Stage Details

### Stage 1: Task Spec (Owner)

The owner writes a task spec using the template in `docs/TASK_SPEC_TEMPLATE.md`. The spec defines:
- Which sub-project the work lives in.
- What the feature does (behavior, not implementation).
- What interfaces it touches.
- What test cases must pass.
- Context tier (what the agent should load).
- HITL tier (what needs approval during implementation).
- Collaboration constraints (if other agents are working in parallel).

The task spec is the contract. The dev agent implements against it. The review agent validates against it. The owner approved it.

### Stage 2: Context Loading (Dev Agent)

The dev agent reads `CLAUDE.md`, then follows the context loading protocol to load the sub-project spec, manifest, and relevant files. The agent does NOT load anything outside the prescribed context path unless it identifies a specific reason and escalates.

### Stage 3: Review Gate (Dev Agent)

Before writing code, the dev agent assesses whether the task requires interface changes, new files, or cross-boundary work. If any of these are true, the agent produces a brief implementation plan and waits for approval.

If the task is entirely within existing interfaces and the assigned sub-project, the agent proceeds directly.

### Stage 4: Plan Approval (Owner)

If a review gate was triggered, the owner reviews the plan. They approve, adjust, or redirect. The agent proceeds only after approval.

### Stage 5: Implementation (Dev Agent)

The agent writes code within the boundaries defined by the task spec and (if applicable) approved plan. Key rules:
- Stay within the assigned sub-project.
- Follow `docs/CONVENTIONS.md`.
- Do not refactor beyond feature scope.
- Do not change interfaces without approval.
- If ambiguity is encountered, escalate (do not guess).

### Stage 6: Testing (Dev Agent)

- If tests were provided in the task spec, make them pass.
- If tests were not provided, write tests first. Present for approval if the task spec requires it. Otherwise, proceed.
- Run the full test suite for the affected sub-project. All tests must pass.

### Stage 7: Completion Artifact (Dev Agent)

The agent produces a structured completion artifact (format defined in `CLAUDE.md`):
- Files changed and added.
- Tests added and results.
- Interface changes (if any, should have been pre-approved).
- Index updates needed.
- Unresolved items.
- Downstream impact.

### Stage 8–9: Code Review (Review Agent)

The review agent receives:
- The original task spec.
- The diff (git diff of the branch).
- The completion artifact.

The review agent checks:
1. **Spec compliance** — does the implementation match the task spec's behavioral requirements?
2. **Convention compliance** — does the code follow `docs/CONVENTIONS.md`?
3. **Interface integrity** — were any interfaces changed without prior approval?
4. **Boundary compliance** — are all changes within the assigned sub-project?
5. **Test coverage** — are test cases from the task spec present and passing?
6. **Index accuracy** — do manifest/index updates in the completion artifact match actual file changes?
7. **Scope creep** — did the agent make changes beyond the feature scope?

The review agent does NOT check:
- Whether the design is good (that's the owner's job via the task spec).
- Whether the feature is the right feature to build (that's the owner's decision).
- Code style preferences beyond what's in `CONVENTIONS.md`.

### Stage 10: Review Report (Review Agent)

The review agent produces a structured report:

```
## Review: [task ID]

**Verdict:** APPROVE / REQUEST CHANGES / ESCALATE

**Spec compliance:** [pass/fail — details if fail]
**Convention compliance:** [pass/fail — details if fail]
**Interface integrity:** [pass/fail — details if fail]
**Boundary compliance:** [pass/fail — details if fail]
**Test coverage:** [pass/fail — details if fail]
**Index accuracy:** [pass/fail — details if fail]
**Scope creep:** [none detected / details if detected]

**Issues:**
1. [issue description + location + severity]

**Notes:**
- [anything the owner should know that isn't a pass/fail]
```

### Stage 11: Final Approval (Owner)

The owner reviews:
- The review agent's report (read this first — it's pre-filtered).
- The diff (if flags were raised or for spot-checking).
- The completion artifact (for downstream impact awareness).

Owner either approves (merge) or requests changes (back to dev agent with specific feedback).

---

## 3. Escalation Handling

When a dev agent escalates during implementation:

1. The agent produces an escalation artifact (format in `CLAUDE.md`).
2. The agent stops working on the feature. It does NOT continue with a guess.
3. The owner responds with a decision.
4. The agent resumes, incorporating the decision.
5. The decision is flagged for recording in `docs/DECISION_LOG.md`.

---

## 4. Multi-Agent Coordination

When two agents work in parallel:

### 4.1 Interface Lock
If agent A's task spec states it depends on an interface, that interface is frozen for the duration of agent A's work. Agent B cannot modify it. This is enforced by the task specs — the owner ensures no two active task specs claim overlapping interface changes.

### 4.2 Branch Isolation
Each agent works on its own branch, scoped to its task. Branches are named per convention: `<type>/<task-id>-<short-description>`.

### 4.3 Ordering
If agent B's work depends on agent A's output, agent A's branch must be merged before agent B begins. The task spec for agent B states this dependency explicitly.

### 4.4 Conflict Resolution
If two agents' branches conflict at merge time, the owner resolves. The review agent does not handle merge conflicts.

---

## 5. Hotfix Path

For critical bugs that bypass the full pipeline:

1. Owner writes a minimal task spec (can be abbreviated).
2. Dev agent fixes the issue + adds a regression test.
3. Review agent reviews (abbreviated report — spec compliance and test coverage only).
4. Owner merges.

Hotfixes still require a review agent pass. No direct-to-merge path.
