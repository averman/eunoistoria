# ADT-004 — Adapter: Postgres Integration Tests

- **Sub-project:** `packages/adapter-postgres`
- **Branch:** `feat/ADT-004-postgres-integration-tests`
- **Depends on:** ADT-003, ENG-013
- **Files created:** `packages/adapter-postgres/tests/integration.test.ts`

## Objective

Same contract verification as ADT-002 but against a real Postgres instance. Tests are skipped if the environment variable `POSTGRES_TEST_URL` is not set.

## Behavior

Test setup:
```typescript
const TEST_URL = process.env['POSTGRES_TEST_URL'];
const skip = !TEST_URL;

beforeEach(async () => {
  if (skip) return;
  // Drop and recreate a test schema to ensure isolation.
  store = createPostgresDataStore(TEST_URL!);
  await store.initializeSchema();
});
```

All test cases mirror ADT-002 (TC-ADT-002-01 through TC-ADT-002-08) applied to the Postgres adapter.

Additionally:
TC-ADT-004-09: `jsonb_rules_round_trip` — add a preset rule with a compound `and` premise, retrieve it, verify `premise` deserialized correctly as a JavaScript object matching the original.

---

## Notes for Implementing Agents

1. **Start with TYP-001 through TYP-005.** Nothing else compiles until types are in place.
2. **ENG-001 (MockDataStore) before any other engine task.** Every engine test file depends on it.
3. **ENG-003, ENG-004, ENG-005, ENG-007 can be implemented in parallel** — they have no inter-dependencies.
4. **ENG-008 through ENG-012 depend on the pure-function modules being complete and tested first.** Do not start CRUD work without passing tests for ENG-004 and ENG-005.
5. **Every public function must have at least one test. Every error path must have a test.** This is non-negotiable per project conventions.
6. **Do not modify `packages/types` after the TYP tasks are merged** without owner approval. The Engine interface is frozen at TYP-005.
7. **SQL-003 is abstract and is not tested in isolation** beyond its helper functions. The integration tests in ADT-002 and ADT-004 are the real contract tests.
8. **Any deviation from the exact type signatures or behaviors specified here requires owner approval.** Flag in the completion artifact, do not self-decide.
