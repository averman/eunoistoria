# ENG-011 — CRUD: Tags

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-011-crud-tags`
- **Depends on:** ENG-008
- **Files created:** `packages/engine/src/crud/tags.ts`, `packages/engine/tests/crud/tags.test.ts`

## Objective

Business logic for tag assignment and removal on documents, and tag search.

## Behavior

```typescript
export async function assignTag(documentId: DocumentId, key: string, value: string, dataStore: DataStorePort): Promise<Result<TagRecord, TagError>>
export async function removeTag(documentId: DocumentId, tagId: TagId, dataStore: DataStorePort): Promise<Result<void, TagError>>
export async function getTagsForDocument(documentId: DocumentId, dataStore: DataStorePort): Promise<Result<TagRecord[], TagError>>
export async function searchTags(projectId: string, key: string | undefined, value: string | undefined, dataStore: DataStorePort): Promise<Result<TagRecord[], TagError>>
```

**`assignTag` flow:**
1. Verify document exists via `getDocumentRecord(documentId)`. If not found: `TagError.DocumentNotFound`.
2. Fetch existing tags via `dataStore.listTagsForDocument(documentId)`.
3. Check for duplicate: if any existing `TagRecord` has `key === key && value === value` → `TagError.DuplicateTagOnDocument`.
4. Call `dataStore.assignTag(documentId, key, value)`.

**`removeTag` flow:**
1. Verify document exists. If not found: `TagError.DocumentNotFound`.
2. Call `dataStore.removeTag(documentId, tagId)`. If `DataStoreError.NotFound`: `TagError.NotFound`.

## Test Cases

TC-011-01: `assign_tag_to_document_succeeds` — tag appears in `getTagsForDocument` result.
TC-011-02: `assign_duplicate_tag_to_document_returns_error` — `TagError.DuplicateTagOnDocument`.
TC-011-03: `assign_same_key_different_value_succeeds` — documents can have multiple tags with same key.
TC-011-04: `remove_tag_succeeds` — tag no longer appears in `getTagsForDocument`.
TC-011-05: `remove_nonexistent_tag_returns_not_found` — `TagError.NotFound`.
TC-011-06: `assign_tag_to_nonexistent_document_returns_error` — `TagError.DocumentNotFound`.

---
