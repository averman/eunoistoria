import {
  DocumentId, PresetId,
  PresetRecord, PresetRuleRecord, PresetAdHocDocumentRecord,
  CreatePresetInput, UpdatePresetInput, AddPresetRuleInput,
  DataStorePort, Result, PresetError, DataStoreError,
} from '@eunoistoria/types';

function mapStorageError(error: DataStoreError): PresetError {
  if (error === DataStoreError.NotFound) return PresetError.NotFound;
  return PresetError.StorageFailure;
}

export async function createPreset(
  input: CreatePresetInput,
  dataStore: DataStorePort
): Promise<Result<PresetRecord, PresetError>> {
  // Verify compositionId is a valid composition document
  const docResult = await dataStore.getDocumentRecord(input.compositionId);
  if (!docResult.ok || !docResult.value.isComposition) {
    return { ok: false, error: PresetError.CompositionNotFound };
  }

  const result = await dataStore.createPreset(input);
  if (!result.ok) return { ok: false, error: PresetError.StorageFailure };
  return result;
}

export async function updatePreset(
  id: PresetId,
  changes: UpdatePresetInput,
  dataStore: DataStorePort
): Promise<Result<PresetRecord, PresetError>> {
  const recordResult = await dataStore.getPresetRecord(id);
  if (!recordResult.ok) return { ok: false, error: mapStorageError(recordResult.error) };

  if (changes.compositionId !== undefined) {
    const docResult = await dataStore.getDocumentRecord(changes.compositionId);
    if (!docResult.ok || !docResult.value.isComposition) {
      return { ok: false, error: PresetError.CompositionNotFound };
    }
  }

  const result = await dataStore.updatePreset(id, changes);
  if (!result.ok) return { ok: false, error: PresetError.StorageFailure };
  return result;
}

export async function deletePreset(
  id: PresetId,
  dataStore: DataStorePort
): Promise<Result<void, PresetError>> {
  const result = await dataStore.deletePreset(id);
  if (!result.ok) return { ok: false, error: mapStorageError(result.error) };
  return result;
}

export async function addRule(
  presetId: PresetId,
  input: AddPresetRuleInput,
  dataStore: DataStorePort
): Promise<Result<PresetRuleRecord, PresetError>> {
  const presetResult = await dataStore.getPresetRecord(presetId);
  if (!presetResult.ok) return { ok: false, error: PresetError.NotFound };

  const result = await dataStore.addPresetRule(presetId, input);
  if (!result.ok) return { ok: false, error: PresetError.StorageFailure };
  return result;
}

export async function removeRule(
  presetId: PresetId,
  ruleId: string,
  dataStore: DataStorePort
): Promise<Result<void, PresetError>> {
  const presetResult = await dataStore.getPresetRecord(presetId);
  if (!presetResult.ok) return { ok: false, error: PresetError.NotFound };

  const result = await dataStore.removePresetRule(presetId, ruleId);
  if (!result.ok) {
    if (result.error === DataStoreError.NotFound) return { ok: false, error: PresetError.RuleNotFound };
    return { ok: false, error: PresetError.StorageFailure };
  }
  return result;
}

export async function reorderRules(
  presetId: PresetId,
  orderedRuleIds: string[],
  dataStore: DataStorePort
): Promise<Result<void, PresetError>> {
  const presetResult = await dataStore.getPresetRecord(presetId);
  if (!presetResult.ok) return { ok: false, error: PresetError.NotFound };

  const rulesResult = await dataStore.listPresetRules(presetId);
  if (!rulesResult.ok) return { ok: false, error: PresetError.StorageFailure };

  const existingIds = new Set(rulesResult.value.map(r => r.id));
  if (
    orderedRuleIds.length !== existingIds.size ||
    !orderedRuleIds.every(id => existingIds.has(id))
  ) {
    return { ok: false, error: PresetError.InvalidRuleOrdering };
  }

  const result = await dataStore.reorderPresetRules(presetId, orderedRuleIds);
  if (!result.ok) return { ok: false, error: PresetError.StorageFailure };
  return result;
}

export async function addAdHocDocument(
  presetId: PresetId,
  documentId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<PresetAdHocDocumentRecord, PresetError>> {
  const presetResult = await dataStore.getPresetRecord(presetId);
  if (!presetResult.ok) return { ok: false, error: PresetError.NotFound };

  const result = await dataStore.addPresetAdHocDocument(presetId, documentId);
  if (!result.ok) return { ok: false, error: PresetError.StorageFailure };
  return result;
}

export async function removeAdHocDocument(
  presetId: PresetId,
  documentId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<void, PresetError>> {
  const presetResult = await dataStore.getPresetRecord(presetId);
  if (!presetResult.ok) return { ok: false, error: PresetError.NotFound };

  const result = await dataStore.removePresetAdHocDocument(presetId, documentId);
  if (!result.ok) return { ok: false, error: PresetError.StorageFailure };
  return result;
}

export async function reorderAdHocDocuments(
  presetId: PresetId,
  orderedDocumentIds: DocumentId[],
  dataStore: DataStorePort
): Promise<Result<void, PresetError>> {
  const presetResult = await dataStore.getPresetRecord(presetId);
  if (!presetResult.ok) return { ok: false, error: PresetError.NotFound };

  const docsResult = await dataStore.listPresetAdHocDocuments(presetId);
  if (!docsResult.ok) return { ok: false, error: PresetError.StorageFailure };

  const existingIds = new Set(docsResult.value.map(d => d.documentId));
  if (
    orderedDocumentIds.length !== existingIds.size ||
    !orderedDocumentIds.every(id => existingIds.has(id))
  ) {
    return { ok: false, error: PresetError.InvalidRuleOrdering };
  }

  const result = await dataStore.reorderPresetAdHocDocuments(presetId, orderedDocumentIds);
  if (!result.ok) return { ok: false, error: PresetError.StorageFailure };
  return result;
}
