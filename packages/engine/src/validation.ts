import {
  DocumentId, PresetId,
  CreateDocumentInput, UpdateDocumentInput, DocumentRecord,
  VariantGroupMemberRecord,
  BrokenReference, RuleValidationReport,
  CreateSlotInput,
  DataStorePort, 
  Result,
  DocumentError, SlotError, VariantGroupError, ValidationError,
} from '@eunoistoria/types';

/**
 * ENG-005: Validation Module
 * Pure and near-pure validation functions used by CRUD modules.
 */

export function validateDocumentCreate(input: CreateDocumentInput): Result<void, DocumentError> {
  if (!input.isComposition && input.content === undefined) {
    return { ok: false, error: DocumentError.LeafRequiresContent };
  }
  if (input.isComposition && input.content !== undefined) {
    return { ok: false, error: DocumentError.CompositionCannotHaveContent };
  }
  return { ok: true, value: undefined };
}

export function validateDocumentUpdate(
  record: DocumentRecord,
  changes: UpdateDocumentInput
): Result<void, DocumentError> {
  if (changes.content !== undefined && changes.content !== null && record.isComposition) {
    return { ok: false, error: DocumentError.CompositionCannotHaveContent };
  }
  return { ok: true, value: undefined };
}

export function validateConvertToComposition(record: DocumentRecord): Result<void, DocumentError> {
  // Idempotent: already a composition or not — always allowed
  return { ok: true, value: undefined };
}

export function validateConvertToLeaf(
  record: DocumentRecord,
  slotCount: number
): Result<void, DocumentError> {
  // Idempotent: already a leaf
  if (!record.isComposition) return { ok: true, value: undefined };
  if (slotCount > 0) {
    return { ok: false, error: DocumentError.CannotConvertCompositionWithSlots };
  }
  return { ok: true, value: undefined };
}

export function validateSlotCreateInput(input: CreateSlotInput): Result<void, SlotError> {
  if (input.referenceType === 'document' && input.referenceDocumentId === undefined) {
    return { ok: false, error: SlotError.TargetNotFound };
  }
  if (input.referenceType === 'variant_group' && input.referenceVariantGroupId === undefined) {
    return { ok: false, error: SlotError.TargetNotFound };
  }
  return { ok: true, value: undefined };
}

export function validateMemberRemoval(
  members: VariantGroupMemberRecord[],
  documentId: DocumentId
): Result<void, VariantGroupError> {
  const member = members.find(m => m.documentId === documentId);
  if (!member) return { ok: false, error: VariantGroupError.MemberNotFound };
  if (member.memberOrder === 0) return { ok: false, error: VariantGroupError.CannotRemoveUniversalDefault };
  return { ok: true, value: undefined };
}

export async function findBrokenReferences(
  projectId: string,
  dataStore: DataStorePort
): Promise<Result<BrokenReference[], ValidationError>> {
  const compositionsResult = await dataStore.listDocuments(projectId, { isComposition: true });
  if (!compositionsResult.ok) return { ok: false, error: ValidationError.StorageFailure };

  const brokenRefs: BrokenReference[] = [];

  for (const composition of compositionsResult.value) {
    const slotsResult = await dataStore.listSlots(composition.id);
    if (!slotsResult.ok) return { ok: false, error: ValidationError.StorageFailure };

    for (const slot of slotsResult.value) {
      if (slot.referenceType === 'document' && slot.referenceDocumentId !== undefined) {
        const docResult = await dataStore.getDocumentRecord(slot.referenceDocumentId);
        if (!docResult.ok) {
          brokenRefs.push({
            compositionId: composition.id,
            slotId: slot.id,
            referenceType: 'document',
            referencedId: slot.referenceDocumentId,
          });
        }
      } else if (slot.referenceType === 'variant_group' && slot.referenceVariantGroupId !== undefined) {
        const groupResult = await dataStore.getVariantGroup(slot.referenceVariantGroupId);
        if (!groupResult.ok) {
          brokenRefs.push({
            compositionId: composition.id,
            slotId: slot.id,
            referenceType: 'variant_group',
            referencedId: slot.referenceVariantGroupId,
          });
        } else {
          // Empty variant group (no members) also counts as broken
          const membersResult = await dataStore.listVariantGroupMemberRecords(slot.referenceVariantGroupId);
          if (!membersResult.ok) return { ok: false, error: ValidationError.StorageFailure };
          if (membersResult.value.length === 0) {
            brokenRefs.push({
              compositionId: composition.id,
              slotId: slot.id,
              referenceType: 'variant_group',
              referencedId: slot.referenceVariantGroupId,
            });
          }
        }
      }
    }
  }

  return { ok: true, value: brokenRefs };
}

export async function validatePresetRules(
  presetId: PresetId,
  dataStore: DataStorePort
): Promise<Result<RuleValidationReport, ValidationError>> {
  const presetResult = await dataStore.getPresetRecord(presetId);
  if (!presetResult.ok) return { ok: false, error: ValidationError.PresetNotFound };

  const rulesResult = await dataStore.listPresetRules(presetId);
  if (!rulesResult.ok) return { ok: false, error: ValidationError.StorageFailure };

  const slotsResult = await dataStore.listSlots(presetResult.value.compositionId);
  if (!slotsResult.ok) return { ok: false, error: ValidationError.StorageFailure };

  const hasVariantSlots = slotsResult.value.some(s => s.referenceType === 'variant_group');

  const issues = rulesResult.value
    .map((rule, ruleIndex) => {
      if (rule.action.type === 'sort_by' || rule.action.type === 'select') {
        if (!hasVariantSlots) {
          return {
            ruleIndex,
            issueType: 'no_matching_slots' as const,
            description: `Rule at index ${ruleIndex} uses ${rule.action.type} but no variant_group slots exist in the composition.`,
          };
        }
      }
      return null;
    })
    .filter(Boolean) as Array<{ ruleIndex: number; issueType: 'no_matching_slots' | 'unknown_variable_reference'; description: string }>;

  return {
    ok: true,
    value: {
      presetId,
      issues,
      isValid: issues.length === 0,
    },
  };
}
