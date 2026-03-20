import {
  DocumentId, SlotId, CompositionSlot,
  CreateSlotInput,
  DataStorePort, Result, SlotError, DataStoreError,
} from '../../../types/src/index';
import { wouldCreateCycle } from '../cycle-detection.js';
import { validateSlotCreateInput } from '../validation.js';

function mapStorageError(error: DataStoreError): SlotError {
  if (error === DataStoreError.NotFound) return SlotError.NotFound;
  return SlotError.StorageFailure;
}

export async function addSlot(
  compositionId: DocumentId,
  input: CreateSlotInput,
  dataStore: DataStorePort
): Promise<Result<CompositionSlot, SlotError>> {
  // Verify composition exists
  const recordResult = await dataStore.getDocumentRecord(compositionId);
  if (!recordResult.ok) return { ok: false, error: SlotError.CompositionNotFound };
  if (!recordResult.value.isComposition) return { ok: false, error: SlotError.CompositionNotFound };

  // Validate input structure
  const validation = validateSlotCreateInput(input);
  if (!validation.ok) return validation;

  // Cycle detection
  if (input.referenceType === 'document' && input.referenceDocumentId !== undefined) {
    const cycleResult = await wouldCreateCycle(compositionId, input.referenceDocumentId, dataStore);
    if (!cycleResult.ok) {
      // If CompositionNotFound, target doesn't exist — fall through to existence check below
      // Otherwise, it's a genuine storage failure
      if (cycleResult.error !== 'CompositionNotFound') {
        return { ok: false, error: SlotError.StorageFailure };
      }
    } else if (cycleResult.value) {
      return { ok: false, error: SlotError.WouldCreateCycle };
    }
  } else if (input.referenceType === 'variant_group' && input.referenceVariantGroupId !== undefined) {
    const membersResult = await dataStore.getVariantGroupMembers(input.referenceVariantGroupId);
    if (membersResult.ok) {
      for (const memberId of membersResult.value) {
        const cycleResult = await wouldCreateCycle(compositionId, memberId, dataStore);
        if (!cycleResult.ok) return { ok: false, error: SlotError.StorageFailure };
        if (cycleResult.value) return { ok: false, error: SlotError.WouldCreateCycle };
      }
    }
  }

  // Verify target exists
  if (input.referenceType === 'document' && input.referenceDocumentId !== undefined) {
    const targetResult = await dataStore.getDocumentRecord(input.referenceDocumentId);
    if (!targetResult.ok) return { ok: false, error: SlotError.TargetNotFound };
  } else if (input.referenceType === 'variant_group' && input.referenceVariantGroupId !== undefined) {
    const groupResult = await dataStore.getVariantGroup(input.referenceVariantGroupId);
    if (!groupResult.ok) return { ok: false, error: SlotError.TargetNotFound };
  }

  const result = await dataStore.createSlot(compositionId, input);
  if (!result.ok) return { ok: false, error: SlotError.StorageFailure };
  return result;
}

export async function removeSlot(
  slotId: SlotId,
  dataStore: DataStorePort
): Promise<Result<void, SlotError>> {
  const result = await dataStore.deleteSlot(slotId);
  if (!result.ok) return { ok: false, error: mapStorageError(result.error) };
  return result;
}

export async function reorderSlots(
  compositionId: DocumentId,
  orderedSlotIds: SlotId[],
  dataStore: DataStorePort
): Promise<Result<void, SlotError>> {
  const slotsResult = await dataStore.listSlots(compositionId);
  if (!slotsResult.ok) return { ok: false, error: SlotError.StorageFailure };

  const existingIds = new Set(slotsResult.value.map(s => s.id));
  if (orderedSlotIds.length !== existingIds.size || !orderedSlotIds.every(id => existingIds.has(id))) {
    return { ok: false, error: SlotError.InvalidOrdering };
  }

  const result = await dataStore.reorderSlots(compositionId, orderedSlotIds);
  if (!result.ok) return { ok: false, error: SlotError.StorageFailure };
  return result;
}

export async function listSlots(
  compositionId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<CompositionSlot[], SlotError>> {
  const recordResult = await dataStore.getDocumentRecord(compositionId);
  if (!recordResult.ok) return { ok: false, error: SlotError.CompositionNotFound };

  const result = await dataStore.listSlots(compositionId);
  if (!result.ok) return { ok: false, error: SlotError.StorageFailure };
  return result;
}
