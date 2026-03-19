# ENG-010 — CRUD: Variant Groups

- **Sub-project:** `packages/engine`
- **Branch:** `feat/ENG-010-crud-variant-groups`
- **Depends on:** ENG-008, ENG-005
- **Files created:** `packages/engine/src/crud/variant-groups.ts`, `packages/engine/tests/crud/variant-groups.test.ts`

## Objective

Business logic for variant group operations: create, delete, add/remove/reorder members, list.

## Behavior

```typescript
export async function createVariantGroup(input: CreateVariantGroupInput, dataStore: DataStorePort): Promise<Result<VariantGroupRecord, VariantGroupError>>
export async function deleteVariantGroup(id: VariantGroupId, dataStore: DataStorePort): Promise<Result<void, VariantGroupError>>
export async function addMember(groupId: VariantGroupId, documentId: DocumentId, dataStore: DataStorePort): Promise<Result<VariantGroupMemberRecord, VariantGroupError>>
export async function removeMember(groupId: VariantGroupId, documentId: DocumentId, dataStore: DataStorePort): Promise<Result<void, VariantGroupError>>
export async function reorderMembers(groupId: VariantGroupId, orderedDocumentIds: DocumentId[], dataStore: DataStorePort): Promise<Result<void, VariantGroupError>>
export async function listVariantGroups(projectId: string, dataStore: DataStorePort): Promise<Result<VariantGroupRecord[], VariantGroupError>>
export async function getMembers(groupId: VariantGroupId, dataStore: DataStorePort): Promise<Result<VariantGroupMemberRecord[], VariantGroupError>>
```

**`addMember` flow:**
1. Verify group exists via `dataStore.getVariantGroup(groupId)`. If not found: `VariantGroupError.NotFound`.
2. Verify document exists via `dataStore.getDocumentRecord(documentId)`. If not found: `VariantGroupError.NotFound` (repurposed — no separate document error; document not found in this context means invalid reference).
3. Fetch current members. If any member has `documentId === documentId` argument: return `VariantGroupError.DocumentAlreadyMember`.
4. Call `dataStore.addVariantGroupMember(groupId, documentId)`.

**`removeMember` flow:**
1. Verify group exists. If not: `VariantGroupError.NotFound`.
2. Fetch current members via `dataStore.listVariantGroupMemberRecords(groupId)`.
3. Call `validateMemberRemoval(members, documentId)`. If error: return.
4. Call `dataStore.removeVariantGroupMember(groupId, documentId)`.

**`reorderMembers` flow:**
1. Fetch current members.
2. Verify `orderedDocumentIds` is a permutation of current member `documentId`s. If not: `VariantGroupError.NotFound` (cannot reorder with unknown members) — use a dedicated check: if set mismatch, return `VariantGroupError.MemberNotFound`.
3. Call `dataStore.reorderVariantGroupMembers(groupId, orderedDocumentIds)`.

## Test Cases

TC-010-01: `create_variant_group_succeeds` — returns VariantGroupRecord with correct projectId and name.
TC-010-02: `add_member_to_group_succeeds` — member appears in getMembers result at end (highest order).
TC-010-03: `add_duplicate_member_returns_error` — `VariantGroupError.DocumentAlreadyMember`.
TC-010-04: `remove_member_at_position_zero_returns_error` — `VariantGroupError.CannotRemoveUniversalDefault`.
TC-010-05: `remove_member_at_non_zero_position_succeeds_and_resequences` — after removal, remaining members have contiguous 0-indexed orders.
TC-010-06: `reorder_members_with_invalid_ids_returns_error` — `VariantGroupError.MemberNotFound`.
TC-010-07: `add_member_to_nonexistent_group_returns_not_found`.

---
