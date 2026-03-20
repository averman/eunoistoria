import {
  DocumentId, DocumentRecord,
  CreateDocumentInput, UpdateDocumentInput, DocumentFilters,
  DataStorePort, Result, DocumentError, DataStoreError,
} from '../../../types/src/index';
import { validateDocumentCreate, validateDocumentUpdate, validateConvertToComposition, validateConvertToLeaf } from '../validation.js';

function mapStorageError(error: DataStoreError): DocumentError {
  if (error === DataStoreError.NotFound) return DocumentError.NotFound;
  return DocumentError.StorageFailure;
}

export async function createDocument(
  input: CreateDocumentInput,
  dataStore: DataStorePort
): Promise<Result<DocumentRecord, DocumentError>> {
  const validation = validateDocumentCreate(input);
  if (!validation.ok) return validation;
  const result = await dataStore.createDocument(input);
  if (!result.ok) return { ok: false, error: DocumentError.StorageFailure };
  return result;
}

export async function getDocument(
  id: DocumentId,
  dataStore: DataStorePort
): Promise<Result<DocumentRecord, DocumentError>> {
  const result = await dataStore.getDocumentRecord(id);
  if (!result.ok) return { ok: false, error: mapStorageError(result.error) };
  return result;
}

export async function updateDocument(
  id: DocumentId,
  changes: UpdateDocumentInput,
  dataStore: DataStorePort
): Promise<Result<DocumentRecord, DocumentError>> {
  const recordResult = await dataStore.getDocumentRecord(id);
  if (!recordResult.ok) return { ok: false, error: mapStorageError(recordResult.error) };

  const validation = validateDocumentUpdate(recordResult.value, changes);
  if (!validation.ok) return validation;

  const result = await dataStore.updateDocument(id, changes);
  if (!result.ok) return { ok: false, error: DocumentError.StorageFailure };
  return result;
}

export async function deleteDocument(
  id: DocumentId,
  dataStore: DataStorePort
): Promise<Result<void, DocumentError>> {
  const result = await dataStore.deleteDocument(id);
  if (!result.ok) return { ok: false, error: mapStorageError(result.error) };
  return result;
}

export async function listDocuments(
  projectId: string,
  filters: DocumentFilters | undefined,
  dataStore: DataStorePort
): Promise<Result<DocumentRecord[], DocumentError>> {
  const result = await dataStore.listDocuments(projectId, filters);
  if (!result.ok) return { ok: false, error: DocumentError.StorageFailure };
  return result;
}

export async function convertToComposition(
  id: DocumentId,
  dataStore: DataStorePort
): Promise<Result<DocumentRecord, DocumentError>> {
  const recordResult = await dataStore.getDocumentRecord(id);
  if (!recordResult.ok) return { ok: false, error: mapStorageError(recordResult.error) };

  const record = recordResult.value;
  const validation = validateConvertToComposition(record);
  if (!validation.ok) return validation;

  // Idempotent: already a composition
  if (record.isComposition) return { ok: true, value: record };

  const result = await dataStore.updateDocument(id, { isComposition: true, content: null });
  if (!result.ok) return { ok: false, error: DocumentError.StorageFailure };
  return result;
}

export async function convertToLeaf(
  id: DocumentId,
  content: string,
  dataStore: DataStorePort
): Promise<Result<DocumentRecord, DocumentError>> {
  const recordResult = await dataStore.getDocumentRecord(id);
  if (!recordResult.ok) return { ok: false, error: mapStorageError(recordResult.error) };

  const record = recordResult.value;

  // Idempotent: already a leaf
  if (!record.isComposition) return { ok: true, value: record };

  const slotsResult = await dataStore.listSlots(id);
  if (!slotsResult.ok) return { ok: false, error: DocumentError.StorageFailure };

  const validation = validateConvertToLeaf(record, slotsResult.value.length);
  if (!validation.ok) return validation;

  const result = await dataStore.updateDocument(id, { isComposition: false, content });
  if (!result.ok) return { ok: false, error: DocumentError.StorageFailure };
  return result;
}
