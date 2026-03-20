import {
  DataStorePort, AccessFilterPort, Engine,
  DocumentId, SlotId, VariantGroupId, TagId, PresetId,
  CreateDocumentInput, UpdateDocumentInput, DocumentFilters,
  CreateSlotInput, CreateVariantGroupInput, CreatePresetInput,
  UpdatePresetInput, AddPresetRuleInput,
  SelectionMap, VariableMap,
  ResolutionError,
  SlotRuleContext, Result,
} from '../../types/src/index';
import { estimateTokens } from './token-estimation.js';
import { evaluateRules } from './rule-evaluator.js';
import { resolveTree } from './resolution.js';
import { wouldCreateCycle } from './cycle-detection.js';
import { findBrokenReferences, validatePresetRules } from './validation.js';
import * as Documents from './crud/documents.js';
import * as Slots from './crud/slots.js';
import * as VariantGroups from './crud/variant-groups.js';
import * as Tags from './crud/tags.js';
import * as Presets from './crud/presets.js';

async function collectSlotContexts(
  compositionId: DocumentId,
  dataStore: DataStorePort
): Promise<Result<SlotRuleContext[], ResolutionError>> {
  const docResult = await dataStore.getDocument(compositionId);
  if (!docResult.ok) {
    return { ok: false, error: ResolutionError.PresetNotFound };
  }
  if (docResult.value.type === 'leaf') return { ok: true, value: [] };

  const contexts: SlotRuleContext[] = [];

  for (const slot of docResult.value.slots) {
    if (slot.referenceType === 'document' && slot.referenceDocumentId !== undefined) {
      const refDocResult = await dataStore.getDocument(slot.referenceDocumentId);
      const tags = refDocResult.ok ? refDocResult.value.tags : [];
      contexts.push({
        slotId: slot.id,
        referenceType: 'document',
        documentTags: tags,
        variantGroupMembers: [],
      });
      if (refDocResult.ok && refDocResult.value.type === 'composition') {
        const nestedResult = await collectSlotContexts(slot.referenceDocumentId, dataStore);
        if (!nestedResult.ok) return nestedResult;
        contexts.push(...nestedResult.value);
      }
    } else if (slot.referenceType === 'variant_group' && slot.referenceVariantGroupId !== undefined) {
      const memberIdsResult = await dataStore.getVariantGroupMembers(slot.referenceVariantGroupId);
      const memberContexts: SlotRuleContext['variantGroupMembers'] = [];

      if (memberIdsResult.ok) {
        for (let i = 0; i < memberIdsResult.value.length; i++) {
          const memberId = memberIdsResult.value[i];
          const memberDocResult = await dataStore.getDocument(memberId);
          const memberTags = memberDocResult.ok ? memberDocResult.value.tags : [];
          memberContexts.push({ documentId: memberId, memberOrder: i, tags: memberTags });
        }
      }

      const defaultMemberTags = memberContexts[0]?.tags ?? [];
      contexts.push({
        slotId: slot.id,
        referenceType: 'variant_group',
        documentTags: defaultMemberTags,
        variantGroupMembers: memberContexts,
      });
    }
  }

  return { ok: true, value: contexts };
}

export function createEngine(dataStore: DataStorePort, accessFilter: AccessFilterPort): Engine {
  return {
    documents: {
      create: (input: CreateDocumentInput) => Documents.createDocument(input, dataStore),
      get: (id: DocumentId) => Documents.getDocument(id, dataStore),
      update: (id: DocumentId, changes: UpdateDocumentInput) => Documents.updateDocument(id, changes, dataStore),
      delete: (id: DocumentId) => Documents.deleteDocument(id, dataStore),
      list: (projectId: string, filters?: DocumentFilters) => Documents.listDocuments(projectId, filters, dataStore),
      convertToComposition: (id: DocumentId) => Documents.convertToComposition(id, dataStore),
      convertToLeaf: (id: DocumentId, content: string) => Documents.convertToLeaf(id, content, dataStore),
    },

    slots: {
      add: (compositionId: DocumentId, input: CreateSlotInput) => Slots.addSlot(compositionId, input, dataStore),
      remove: (slotId: SlotId) => Slots.removeSlot(slotId, dataStore),
      reorder: (compositionId: DocumentId, orderedSlotIds: SlotId[]) => Slots.reorderSlots(compositionId, orderedSlotIds, dataStore),
      list: (compositionId: DocumentId) => Slots.listSlots(compositionId, dataStore),
    },

    variantGroups: {
      create: (input: CreateVariantGroupInput) => VariantGroups.createVariantGroup(input, dataStore),
      delete: (id: VariantGroupId) => VariantGroups.deleteVariantGroup(id, dataStore),
      addMember: (groupId: VariantGroupId, documentId: DocumentId) => VariantGroups.addMember(groupId, documentId, dataStore),
      removeMember: (groupId: VariantGroupId, documentId: DocumentId) => VariantGroups.removeMember(groupId, documentId, dataStore),
      reorderMembers: (groupId: VariantGroupId, orderedDocumentIds: DocumentId[]) => VariantGroups.reorderMembers(groupId, orderedDocumentIds, dataStore),
      list: (projectId: string) => VariantGroups.listVariantGroups(projectId, dataStore),
      getMembers: (groupId: VariantGroupId) => VariantGroups.getMembers(groupId, dataStore),
    },

    tags: {
      assign: (documentId: DocumentId, key: string, value: string) => Tags.assignTag(documentId, key, value, dataStore),
      remove: (documentId: DocumentId, tagId: TagId) => Tags.removeTag(documentId, tagId, dataStore),
      getForDocument: (documentId: DocumentId) => Tags.getTagsForDocument(documentId, dataStore),
      search: (projectId: string, key?: string, value?: string) => Tags.searchTags(projectId, key, value, dataStore),
    },

    presets: {
      create: (input: CreatePresetInput) => Presets.createPreset(input, dataStore),
      update: (id: PresetId, changes: UpdatePresetInput) => Presets.updatePreset(id, changes, dataStore),
      delete: (id: PresetId) => Presets.deletePreset(id, dataStore),
      addRule: (presetId: PresetId, input: AddPresetRuleInput) => Presets.addRule(presetId, input, dataStore),
      removeRule: (presetId: PresetId, ruleId: string) => Presets.removeRule(presetId, ruleId, dataStore),
      reorderRules: (presetId: PresetId, orderedRuleIds: string[]) => Presets.reorderRules(presetId, orderedRuleIds, dataStore),
      addAdHocDocument: (presetId: PresetId, documentId: DocumentId) => Presets.addAdHocDocument(presetId, documentId, dataStore),
      removeAdHocDocument: (presetId: PresetId, documentId: DocumentId) => Presets.removeAdHocDocument(presetId, documentId, dataStore),
      reorderAdHocDocuments: (presetId: PresetId, orderedDocumentIds: DocumentId[]) => Presets.reorderAdHocDocuments(presetId, orderedDocumentIds, dataStore),
    },

    resolution: {
      async evaluateRules(presetId: PresetId, variables: VariableMap) {
        const presetResult = await dataStore.getPreset(presetId);
        if (!presetResult.ok) return { ok: false, error: ResolutionError.PresetNotFound };

        const slotContextsResult = await collectSlotContexts(presetResult.value.baseCompositionId, dataStore);
        if (!slotContextsResult.ok) return slotContextsResult;
        const selectionMap = evaluateRules(presetResult.value.rules, variables, slotContextsResult.value);
        return { ok: true, value: selectionMap };
      },

      async resolve(presetId: PresetId, variables: VariableMap, selectionMap: SelectionMap) {
        const presetResult = await dataStore.getPreset(presetId);
        if (!presetResult.ok) return { ok: false, error: ResolutionError.PresetNotFound };

        const mainResult = await resolveTree(presetResult.value.baseCompositionId, selectionMap, accessFilter, dataStore, 0);
        if (!mainResult.ok) return mainResult;

        const parts: string[] = [];
        if (mainResult.value !== '') parts.push(mainResult.value);

        for (const adHocDocId of presetResult.value.adHocDocuments) {
          const adHocResult = await resolveTree(adHocDocId, selectionMap, accessFilter, dataStore, 0);
          if (!adHocResult.ok) return adHocResult;
          if (adHocResult.value !== '') parts.push(adHocResult.value);
        }

        return { ok: true, value: parts.join('\n\n') };
      },

      async resolveComposition(compositionId: DocumentId) {
        const defaultSelectionMap: SelectionMap = { toggleStates: new Map(), sortOrders: new Map() };
        return resolveTree(compositionId, defaultSelectionMap, accessFilter, dataStore, 0);
      },

      estimateTokens(content: string): number {
        return estimateTokens(content);
      },
    },

    validation: {
      async wouldCreateCycle(compositionId: DocumentId, targetDocumentId: DocumentId) {
        return wouldCreateCycle(compositionId, targetDocumentId, dataStore);
      },
      async validatePresetRules(presetId: PresetId) {
        return validatePresetRules(presetId, dataStore);
      },
      async findBrokenReferences(projectId: string) {
        return findBrokenReferences(projectId, dataStore);
      },
    },
  };
}
