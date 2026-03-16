# Task Spec Template

## Extendable Markdown Editor — Standard Format for Feature Assignments

---

Copy and fill in the template below for each feature task. This is the contract between the owner, dev agent, and review agent.

---

```markdown
# Task Spec: [TASK-ID] [Short Title]

## 1. Assignment

- **Sub-project:** [e.g., `packages/engine`]
- **Branch:** [e.g., `feat/ENG-012-sort-by-action`]
- **Depends on:** [task IDs that must be merged first, or "none"]
- **Blocked by:** [interface locks from other active tasks, or "none"]

## 2. Objective

[1-3 sentences. What this feature does from the user's or system's perspective. Not how — what.]

## 3. Behavior

[Precise behavioral requirements. Use "must", "must not", "should" language.]

- The system must [behavior A].
- When [condition], the system must [behavior B].
- The system must not [anti-behavior].
- If [error condition], the system must return [specific error].

## 4. Interface Changes

[If this task changes any port interface, shared type, or public API, describe the changes here. These must be pre-approved by the owner before implementation begins.]

- [ ] No interface changes required.
- [ ] Interface changes required (describe below):
  - [interface name]: [what changes]

## 5. Test Cases

[Minimum test cases that must pass. The dev agent may add more, but these are mandatory.]

1. **[test name]** — given [setup], when [action], then [expected result].
2. **[test name]** — given [setup], when [action], then [expected result].
3. **[test name — error path]** — given [setup], when [action], then [expected error].

## 6. Context Loading

[Which files the agent must load. Follow the protocol in CLAUDE.md, but specify any additional files needed for this task.]

- `CLAUDE.md` (always)
- `packages/[sub-project]/[SPEC].md`
- [additional files specific to this task]

## 7. HITL Tier

[Override or supplement the default HITL rules from CLAUDE.md for this task.]

- [ ] Default HITL rules apply (no overrides).
- [ ] Additional review gates:
  - [describe when the agent must stop and ask]
- [ ] Reduced gates (trusted scope):
  - [describe what the agent can proceed with without asking]

## 8. Collaboration Constraints

- [ ] No other agents are working in this sub-project.
- [ ] Other active tasks in this sub-project:
  - [TASK-ID]: [what they're touching — do not modify these files/interfaces]

## 9. Scope Boundary

[What this task explicitly does NOT include. Prevents scope creep.]

- This task does not include [X].
- This task does not modify [Y].
- If [related concern] is encountered, escalate — do not address.

## 10. Notes

[Any additional context, design rationale, or references to decision log entries.]
```

---

## Usage Notes

### For the Owner
- Fill in every section. Empty sections cause agent ambiguity and wasted escalations.
- Test cases are the spec. If you can't write test cases, the feature isn't well-defined enough to assign.
- Be explicit about scope boundaries. AI agents are thorough — they'll "helpfully" fix adjacent issues unless told not to.
- Interface changes should ideally be designed by you, not the agent. The agent implements, not architects.

### For the Dev Agent
- This is your contract. Implement what it says. Nothing more.
- If a test case is ambiguous, escalate. Do not interpret.
- If you discover an issue outside the scope boundary, note it in the completion artifact under "Unresolved." Do not fix it.

### For the Review Agent
- Validate the implementation against sections 2, 3, 4, and 5. These are the verifiable claims.
- Validate scope compliance against section 9.
- Section 10 is informational — do not validate against it.
