import {
  DocumentId, TagId,
  TagRecord,
  DataStorePort, Result, TagError, DataStoreError,
} from '@eunoistoria/types';

export async function assignTag(
  documentId: DocumentId,
  key: string,
  value: string,
  dataStore: DataStorePort
): Promise<Result<TagRecord, TagError>> {
  // Verify document exists
  const docResult = await dataStore.getDocumentRecord(documentId);
  if (!docResult.ok) return { ok: false, error: TagError.DocumentNotFound };

  // Check for duplicate
  const tagsResult = await dataStore.listTagsForDocument(documentId);
  if (!tagsResult.ok) return { ok: false, error: TagError.StorageFailure };
  if (tagsResult.value.some(t => t.key === key && t.value === value)) {
    return { ok: false, error: TagError.DuplicateTagOnDocument };
  }

  const result = await dataStore.assignTag(documentId, key, value);
  if (!result.ok) return { ok: false, error: TagError.StorageFailure };
  return result;
}

export async function removeTag(
  documentId: DocumentId,
  tagId: TagId,
  dataStore: DataStorePort
): Promise<Result<void, TagError>> {
  const docResult = await dataStore.getDocumentRecord(documentId);
  if (!docResult.ok) return { ok: false, error: TagError.DocumentNotFound };

  const result = await dataStore.removeTag(documentId, tagId);
  if (!result.ok) {
    if (result.error === DataStoreError.NotFound) return { ok: false, error: TagError.NotFound };
    return { ok: false, error: TagError.StorageFailure };
  }
  return result;
}

export async function getTagsForDocument(
  documentId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<TagRecord[], TagError>> {
  const result = await dataStore.listTagsForDocument(documentId);
  if (!result.ok) return { ok: false, error: TagError.StorageFailure };
  return result;
}

export async function searchTags(
  projectId: string,
  key: string | undefined,
  value: string | undefined,
  dataStore: DataStorePort
): Promise<Result<TagRecord[], TagError>> {
  const result = await dataStore.searchTags(projectId, key, value);
  if (!result.ok) return { ok: false, error: TagError.StorageFailure };
  return result;
}
