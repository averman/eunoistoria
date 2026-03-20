import {
  DocumentId, DataStorePort,
  Result, ValidationError, DataStoreError,
} from '@eunoistoria/types';

/**
 * ENG-004: Cycle Detection
 * BFS walk from the target node to detect if adding a reference from
 * `compositionId` to `targetDocumentId` would create a cycle.
 */
export async function wouldCreateCycle(
  compositionId: DocumentId,
  targetDocumentId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<boolean, ValidationError>> {
  // Self-reference is a cycle
  if (targetDocumentId === compositionId) {
    return { ok: true, value: true };
  }

  // Fetch the target document record
  const targetResult = await dataStore.getDocumentRecord(targetDocumentId);
  if (!targetResult.ok) {
    return { ok: false, error: ValidationError.CompositionNotFound };
  }

  // If target is not a composition, leaves cannot form cycles
  if (!targetResult.value.isComposition) {
    return { ok: true, value: false };
  }

  // BFS
  const visited = new Set<DocumentId>();
  visited.add(compositionId); // protect this node

  const queue: DocumentId[] = [targetDocumentId];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current)) {
      return { ok: true, value: true };
    }
    visited.add(current);

    // Fetch slots of current
    const slotsResult = await dataStore.listSlots(current);
    if (!slotsResult.ok) {
      return { ok: false, error: ValidationError.StorageFailure };
    }

    for (const slot of slotsResult.value) {
      if (slot.referenceType === 'document' && slot.referenceDocumentId !== undefined) {
        const docResult = await dataStore.getDocumentRecord(slot.referenceDocumentId);
        if (docResult.ok && docResult.value.isComposition) {
          queue.push(slot.referenceDocumentId);
        } else if (!docResult.ok && docResult.error !== DataStoreError.NotFound) {
          return { ok: false, error: ValidationError.StorageFailure };
        }
      } else if (slot.referenceType === 'variant_group' && slot.referenceVariantGroupId !== undefined) {
        const membersResult = await dataStore.getVariantGroupMembers(slot.referenceVariantGroupId);
        if (!membersResult.ok) {
          return { ok: false, error: ValidationError.StorageFailure };
        }
        for (const memberId of membersResult.value) {
          const memberDocResult = await dataStore.getDocumentRecord(memberId);
          if (memberDocResult.ok && memberDocResult.value.isComposition) {
            queue.push(memberId);
          } else if (!memberDocResult.ok && memberDocResult.error !== DataStoreError.NotFound) {
            return { ok: false, error: ValidationError.StorageFailure };
          }
        }
      }
    }
  }

  return { ok: true, value: false };
}
