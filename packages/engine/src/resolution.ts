import {
  DocumentId, SelectionMap, AccessFilterPort, DataStorePort,
  Result, ResolutionError, DataStoreError,
} from '../../types/src/index';

export const MAX_RECURSION_DEPTH = 20;

export async function resolveTree(
  nodeId: DocumentId,
  selectionMap: SelectionMap,
  accessFilter: AccessFilterPort,
  dataStore: DataStorePort,
  depth: number
): Promise<Result<string, ResolutionError>> {
  if (depth >= MAX_RECURSION_DEPTH) {
    return { ok: false, error: ResolutionError.MaxDepthExceeded };
  }

  const docResult = await dataStore.getDocument(nodeId);
  if (!docResult.ok) {
    if (docResult.error === DataStoreError.NotFound) {
      // Broken reference (document deleted). Silent skip for MVP.
      // Future: Return error or include warning in resolution metadata.
      // This allows partial resolution even if a document in the tree is missing.
      return { ok: true, value: '' };
    }
    return { ok: false, error: ResolutionError.BrokenReference };
  }

  const document = docResult.value;

  if (document.type === 'leaf') {
    return { ok: true, value: document.content };
  }

  // DataComposition
  const parts: string[] = [];

  for (const slot of document.slots) {
    // Check toggle state
    const isOn = selectionMap.toggleStates.get(slot.id) ?? true;
    if (!isOn) continue;

    let targetId: DocumentId | null = null;

    if (slot.referenceType === 'document') {
      targetId = slot.referenceDocumentId ?? null;
    } else if (slot.referenceType === 'variant_group') {
      const sortOrder = selectionMap.sortOrders.get(slot.id);
      let resolved: DocumentId | null = null;

      if (sortOrder && sortOrder.length > 0) {
        for (const candidateId of sortOrder) {
          if (await accessFilter.canAccess(candidateId)) {
            resolved = candidateId;
            break;
          }
        }
      }

      if (resolved === null && slot.referenceVariantGroupId !== undefined) {
        // Fallback: iterate members in order, pick first accessible one
        const membersResult = await dataStore.getVariantGroupMembers(slot.referenceVariantGroupId);
        if (membersResult.ok && membersResult.value.length > 0) {
          for (const memberId of membersResult.value) {
            if (await accessFilter.canAccess(memberId)) {
              resolved = memberId;
              break;
            }
          }
          // If still null (no accessible member), use position-0 as last resort
          if (resolved === null) {
            resolved = membersResult.value[0];
          }
        }
      }

      targetId = resolved;
    }

    if (targetId === null) continue; // broken reference → silent

    const childResult = await resolveTree(targetId, selectionMap, accessFilter, dataStore, depth + 1);
    if (!childResult.ok) return childResult; // propagate error

    if (childResult.value !== '') {
      parts.push(childResult.value);
    }
  }

  return { ok: true, value: parts.join('\n\n') };
}
