import { ResolutionError, } from '@eunoistoria/types';
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
async function collectSlotContexts(compositionId, dataStore) {
    const docResult = await dataStore.getDocument(compositionId);
    if (!docResult.ok) {
        return { ok: false, error: ResolutionError.PresetNotFound };
    }
    if (docResult.value.type === 'leaf')
        return { ok: true, value: [] };
    const contexts = [];
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
                if (!nestedResult.ok)
                    return nestedResult;
                contexts.push(...nestedResult.value);
            }
        }
        else if (slot.referenceType === 'variant_group' && slot.referenceVariantGroupId !== undefined) {
            const memberIdsResult = await dataStore.getVariantGroupMembers(slot.referenceVariantGroupId);
            const memberContexts = [];
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
export function createEngine(dataStore, accessFilter) {
    return {
        documents: {
            create: (input) => Documents.createDocument(input, dataStore),
            get: (id) => Documents.getDocument(id, dataStore),
            update: (id, changes) => Documents.updateDocument(id, changes, dataStore),
            delete: (id) => Documents.deleteDocument(id, dataStore),
            list: (projectId, filters) => Documents.listDocuments(projectId, filters, dataStore),
            convertToComposition: (id) => Documents.convertToComposition(id, dataStore),
            convertToLeaf: (id, content) => Documents.convertToLeaf(id, content, dataStore),
        },
        slots: {
            add: (compositionId, input) => Slots.addSlot(compositionId, input, dataStore),
            remove: (slotId) => Slots.removeSlot(slotId, dataStore),
            reorder: (compositionId, orderedSlotIds) => Slots.reorderSlots(compositionId, orderedSlotIds, dataStore),
            list: (compositionId) => Slots.listSlots(compositionId, dataStore),
        },
        variantGroups: {
            create: (input) => VariantGroups.createVariantGroup(input, dataStore),
            delete: (id) => VariantGroups.deleteVariantGroup(id, dataStore),
            addMember: (groupId, documentId) => VariantGroups.addMember(groupId, documentId, dataStore),
            removeMember: (groupId, documentId) => VariantGroups.removeMember(groupId, documentId, dataStore),
            reorderMembers: (groupId, orderedDocumentIds) => VariantGroups.reorderMembers(groupId, orderedDocumentIds, dataStore),
            list: (projectId) => VariantGroups.listVariantGroups(projectId, dataStore),
            getMembers: (groupId) => VariantGroups.getMembers(groupId, dataStore),
        },
        tags: {
            assign: (documentId, key, value) => Tags.assignTag(documentId, key, value, dataStore),
            remove: (documentId, tagId) => Tags.removeTag(documentId, tagId, dataStore),
            getForDocument: (documentId) => Tags.getTagsForDocument(documentId, dataStore),
            search: (projectId, key, value) => Tags.searchTags(projectId, key, value, dataStore),
        },
        presets: {
            create: (input) => Presets.createPreset(input, dataStore),
            update: (id, changes) => Presets.updatePreset(id, changes, dataStore),
            delete: (id) => Presets.deletePreset(id, dataStore),
            addRule: (presetId, input) => Presets.addRule(presetId, input, dataStore),
            removeRule: (presetId, ruleId) => Presets.removeRule(presetId, ruleId, dataStore),
            reorderRules: (presetId, orderedRuleIds) => Presets.reorderRules(presetId, orderedRuleIds, dataStore),
            addAdHocDocument: (presetId, documentId) => Presets.addAdHocDocument(presetId, documentId, dataStore),
            removeAdHocDocument: (presetId, documentId) => Presets.removeAdHocDocument(presetId, documentId, dataStore),
            reorderAdHocDocuments: (presetId, orderedDocumentIds) => Presets.reorderAdHocDocuments(presetId, orderedDocumentIds, dataStore),
        },
        resolution: {
            async evaluateRules(presetId, variables) {
                const presetResult = await dataStore.getPreset(presetId);
                if (!presetResult.ok)
                    return { ok: false, error: ResolutionError.PresetNotFound };
                const slotContextsResult = await collectSlotContexts(presetResult.value.baseCompositionId, dataStore);
                if (!slotContextsResult.ok)
                    return slotContextsResult;
                const selectionMap = evaluateRules(presetResult.value.rules, variables, slotContextsResult.value);
                return { ok: true, value: selectionMap };
            },
            async resolve(presetId, variables, selectionMap) {
                const presetResult = await dataStore.getPreset(presetId);
                if (!presetResult.ok)
                    return { ok: false, error: ResolutionError.PresetNotFound };
                const mainResult = await resolveTree(presetResult.value.baseCompositionId, selectionMap, accessFilter, dataStore, 0);
                if (!mainResult.ok)
                    return mainResult;
                const parts = [];
                if (mainResult.value !== '')
                    parts.push(mainResult.value);
                for (const adHocDocId of presetResult.value.adHocDocuments) {
                    const adHocResult = await resolveTree(adHocDocId, selectionMap, accessFilter, dataStore, 0);
                    if (!adHocResult.ok)
                        return adHocResult;
                    if (adHocResult.value !== '')
                        parts.push(adHocResult.value);
                }
                return { ok: true, value: parts.join('\n\n') };
            },
            async resolveComposition(compositionId) {
                const defaultSelectionMap = { toggleStates: new Map(), sortOrders: new Map() };
                return resolveTree(compositionId, defaultSelectionMap, accessFilter, dataStore, 0);
            },
            estimateTokens(content) {
                return estimateTokens(content);
            },
        },
        validation: {
            async wouldCreateCycle(compositionId, targetDocumentId) {
                return wouldCreateCycle(compositionId, targetDocumentId, dataStore);
            },
            async validatePresetRules(presetId) {
                return validatePresetRules(presetId, dataStore);
            },
            async findBrokenReferences(projectId) {
                return findBrokenReferences(projectId, dataStore);
            },
        },
    };
}
//# sourceMappingURL=index.js.map