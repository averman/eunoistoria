import {
  DocumentId, VariantGroupId,
  VariantGroupRecord, VariantGroupMemberRecord,
  CreateVariantGroupInput,
  DataStorePort, Result, VariantGroupError, DataStoreError,
} from '@eunoistoria/types';
import { validateMemberRemoval } from '../validation.js';

function mapStorageError(error: DataStoreError): VariantGroupError {
  if (error === DataStoreError.NotFound) return VariantGroupError.NotFound;
  return VariantGroupError.StorageFailure;
}

export async function createVariantGroup(
  input: CreateVariantGroupInput,
  dataStore: DataStorePort
): Promise<Result<VariantGroupRecord, VariantGroupError>> {
  const result = await dataStore.createVariantGroup(input);
  if (!result.ok) return { ok: false, error: VariantGroupError.StorageFailure };
  return result;
}

export async function deleteVariantGroup(
  id: VariantGroupId,
  dataStore: DataStorePort
): Promise<Result<void, VariantGroupError>> {
  const result = await dataStore.deleteVariantGroup(id);
  if (!result.ok) return { ok: false, error: mapStorageError(result.error) };
  return result;
}

export async function addMember(
  groupId: VariantGroupId,
  documentId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<VariantGroupMemberRecord, VariantGroupError>> {
  // Verify group exists
  const groupResult = await dataStore.getVariantGroup(groupId);
  if (!groupResult.ok) return { ok: false, error: VariantGroupError.NotFound };

  // Verify document exists
  const docResult = await dataStore.getDocumentRecord(documentId);
  if (!docResult.ok) return { ok: false, error: VariantGroupError.NotFound };

  // Check for duplicate member
  const membersResult = await dataStore.listVariantGroupMemberRecords(groupId);
  if (!membersResult.ok) return { ok: false, error: VariantGroupError.StorageFailure };
  if (membersResult.value.some(m => m.documentId === documentId)) {
    return { ok: false, error: VariantGroupError.DocumentAlreadyMember };
  }

  const result = await dataStore.addVariantGroupMember(groupId, documentId);
  if (!result.ok) return { ok: false, error: VariantGroupError.StorageFailure };
  return result;
}

export async function removeMember(
  groupId: VariantGroupId,
  documentId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<void, VariantGroupError>> {
  // Verify group exists
  const groupResult = await dataStore.getVariantGroup(groupId);
  if (!groupResult.ok) return { ok: false, error: VariantGroupError.NotFound };

  const membersResult = await dataStore.listVariantGroupMemberRecords(groupId);
  if (!membersResult.ok) return { ok: false, error: VariantGroupError.StorageFailure };

  const validation = validateMemberRemoval(membersResult.value, documentId);
  if (!validation.ok) return validation;

  const result = await dataStore.removeVariantGroupMember(groupId, documentId);
  if (!result.ok) return { ok: false, error: VariantGroupError.StorageFailure };
  return result;
}

export async function reorderMembers(
  groupId: VariantGroupId,
  orderedDocumentIds: DocumentId[],
  dataStore: DataStorePort
): Promise<Result<void, VariantGroupError>> {
  const membersResult = await dataStore.listVariantGroupMemberRecords(groupId);
  if (!membersResult.ok) return { ok: false, error: VariantGroupError.StorageFailure };

  const existingIds = new Set(membersResult.value.map(m => m.documentId));
  if (
    orderedDocumentIds.length !== existingIds.size ||
    !orderedDocumentIds.every(id => existingIds.has(id))
  ) {
    return { ok: false, error: VariantGroupError.MemberNotFound };
  }

  const result = await dataStore.reorderVariantGroupMembers(groupId, orderedDocumentIds);
  if (!result.ok) return { ok: false, error: VariantGroupError.StorageFailure };
  return result;
}

export async function listVariantGroups(
  projectId: string,
  dataStore: DataStorePort
): Promise<Result<VariantGroupRecord[], VariantGroupError>> {
  const result = await dataStore.listVariantGroups(projectId);
  if (!result.ok) return { ok: false, error: VariantGroupError.StorageFailure };
  return result;
}

export async function getMembers(
  groupId: VariantGroupId,
  dataStore: DataStorePort
): Promise<Result<VariantGroupMemberRecord[], VariantGroupError>> {
  const groupResult = await dataStore.getVariantGroup(groupId);
  if (!groupResult.ok) return { ok: false, error: VariantGroupError.NotFound };

  const result = await dataStore.listVariantGroupMemberRecords(groupId);
  if (!result.ok) return { ok: false, error: VariantGroupError.StorageFailure };
  return result;
}
