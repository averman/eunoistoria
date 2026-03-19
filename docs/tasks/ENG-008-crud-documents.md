# ENG-008 — CRUD: Documents

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-008-crud-documents`
- **Depends on:** ENG-004, ENG-005, ENG-007, ENG-001
- **Files created:** `packages/engine/src/crud/documents.ts`, `packages/engine/tests/crud/documents.test.ts`

## Objective

Business logic for all document CRUD operations: create, get, update, delete, list, convertToComposition, convertToLeaf. All validation happens before the data store is called.

## Behavior

**Exported functions** (each takes `dataStore: DataStorePort` as the last argument):

```typescript
export async function createDocument(input: CreateDocumentInput, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
export async function getDocument(id: DocumentId, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
export async function updateDocument(id: DocumentId, changes: UpdateDocumentInput, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
export async function deleteDocument(id: DocumentId, dataStore: DataStorePort): Promise<Result<void, DocumentError>>
export async function listDocuments(projectId: string, filters: DocumentFilters | undefined, dataStore: DataStorePort): Promise<Result<DocumentRecord[], DocumentError>>
export async function convertToComposition(id: DocumentId, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
export async function convertToLeaf(id: DocumentId, content: string, dataStore: DataStorePort): Promise<Result<DocumentRecord, DocumentError>>
```

**`createDocument` flow:**
1. Call `validateDocumentCreate(input)`. If error: return mapped error.
2. Call `dataStore.createDocument(input)`. Map `DataStoreError` to `DocumentError.StorageFailure`.

**`getDocument` flow:**
1. `dataStore.getDocumentRecord(id)`. If `DataStoreError.NotFound`: `DocumentError.NotFound`. Other errors: `DocumentError.StorageFailure`.

**`updateDocument` flow:**
1. Fetch current record via `getDocumentRecord(id)`. If not found: `DocumentError.NotFound`.
2. Call `validateDocumentUpdate(record, changes)`. If error: return.
3. Call `dataStore.updateDocument(id, changes)`.

**`deleteDocument` flow:**
1. Call `dataStore.deleteDocument(id)`. If `DataStoreError.NotFound`: `DocumentError.NotFound`.

**`listDocuments` flow:**
1. Call `dataStore.listDocuments(projectId, filters)`. Map errors to `DocumentError.StorageFailure`.

**`convertToComposition` flow:**
1. Fetch record. If not found: `DocumentError.NotFound`.
2. Call `validateConvertToComposition(record)`.
3. If `record.isComposition === true`: return current record immediately (idempotent).
4. Call `dataStore.updateDocument(id, { isComposition: true, content: null })`.

**`convertToLeaf` flow:**
1. Fetch record. If not found: `DocumentError.NotFound`.
2. If `record.isComposition === false`: return current record immediately (idempotent).
3. Call `dataStore.listSlots(id)` to get slot count.
4. Call `validateConvertToLeaf(record, slots.length)`. If error: return.
5. Call `dataStore.updateDocument(id, { isComposition: false, content })`.

**DataStoreError mapping rule (applies to all functions):**
- `DataStoreError.NotFound` → entity-specific `NotFound` error.
- All other `DataStoreError` variants → `StorageFailure`.

## Test Cases

TC-008-01: `create_leaf_document` — creates a leaf with content, returns DocumentRecord with correct fields.
TC-008-02: `create_composition_document` — creates a composition, returns record with `isComposition: true, content: null`.
TC-008-03: `create_leaf_without_content_returns_error` — `LeafRequiresContent`.
TC-008-04: `create_composition_with_content_returns_error` — `CompositionCannotHaveContent`.
TC-008-05: `get_nonexistent_document_returns_not_found` — `DocumentError.NotFound`.
TC-008-06: `update_content_of_composition_returns_error` — `DocumentError.CompositionCannotHaveContent`.
TC-008-07: `convert_composition_to_leaf_with_slots_returns_error` — `DocumentError.CannotConvertCompositionWithSlots`.
TC-008-08: `convert_to_composition_is_idempotent` — calling `convertToComposition` on an already-composition returns the current record without error.
TC-008-09: `convert_to_leaf_is_idempotent` — calling `convertToLeaf` on an already-leaf returns the current record without error.
TC-008-10: `convert_empty_composition_to_leaf` — composition with zero slots → succeeds, returns record with `isComposition: false, content: provided`.

---
