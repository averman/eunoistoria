import {
  DataStorePort,
  DocumentId, SlotId, VariantGroupId, TagId, PresetId,
  DataDocument, DataLeaf, DataComposition, Preset,
  CompositionSlot, Tag,
  DocumentRecord, VariantGroupRecord, VariantGroupMemberRecord, TagRecord,
  PresetRecord, PresetRuleRecord, PresetAdHocDocumentRecord,
  CreateDocumentInput, UpdateDocumentInput, DocumentFilters, CreateSlotInput,
  CreateVariantGroupInput, CreatePresetInput, UpdatePresetInput,
  AddPresetRuleInput, DocumentPredicate,
  Result, DataStoreError,
} from '@eunoistoria/types';

export function createMockDataStore(): DataStorePort {
  // Internal storage
  const documents = new Map<DocumentId, DocumentRecord>();
  const slots = new Map<SlotId, CompositionSlot>();
  const slotsByComposition = new Map<DocumentId, SlotId[]>();
  const variantGroups = new Map<VariantGroupId, VariantGroupRecord>();
  const variantGroupMembers = new Map<VariantGroupId, VariantGroupMemberRecord[]>();
  const tags = new Map<TagId, TagRecord>();
  const documentTags = new Map<DocumentId, TagId[]>();
  const presets = new Map<PresetId, PresetRecord>();
  const presetRules = new Map<PresetId, PresetRuleRecord[]>();
  const presetAdHocDocs = new Map<PresetId, PresetAdHocDocumentRecord[]>();

  function ok<T>(value: T): Result<T, DataStoreError> {
    return { ok: true, value };
  }

  function notFound<T>(): Result<T, DataStoreError> {
    return { ok: false, error: DataStoreError.NotFound };
  }

  function coerce(v: string): number | string {
    const n = Number(v);
    return isNaN(n) ? v : n;
  }

  function applyTagPredicate(
    predicate: DocumentPredicate,
    docTags: TagRecord[]
  ): boolean {
    if (predicate.type === 'is_composition') {
      // handled separately
      return true;
    }
    if (predicate.type === 'tag_has_key') {
      return docTags.some(t => t.key === predicate.key);
    }
    if (predicate.type === 'tag_in') {
      const coercedValues = predicate.values.map(v => coerce(v));
      return docTags.some(t => t.key === predicate.key && coercedValues.some(cv => {
        const cv2 = coerce(t.value);
        return typeof cv === 'number' && typeof cv2 === 'number' ? cv === cv2 : String(cv) === String(cv2);
      }));
    }
    if (predicate.type === 'tag_not_in') {
      const coercedValues = predicate.values.map(v => coerce(v));
      return !docTags.some(t => t.key === predicate.key && coercedValues.some(cv => {
        const cv2 = coerce(t.value);
        return typeof cv === 'number' && typeof cv2 === 'number' ? cv === cv2 : String(cv) === String(cv2);
      }));
    }

    // Binary comparison predicates
    const tag = docTags.find(t => t.key === predicate.key);
    if (!tag) return false;
    const left = coerce(tag.value);
    const right = coerce((predicate as { value: string }).value);
    const bothNumeric = typeof left === 'number' && typeof right === 'number';

    switch (predicate.type) {
      case 'tag_eq':  return bothNumeric ? left === right : String(left) === String(right);
      case 'tag_neq': return bothNumeric ? left !== right : String(left) !== String(right);
      case 'tag_lt':  return bothNumeric ? left < right : String(left) < String(right);
      case 'tag_lte': return bothNumeric ? left <= right : String(left) <= String(right);
      case 'tag_gt':  return bothNumeric ? left > right : String(left) > String(right);
      case 'tag_gte': return bothNumeric ? left >= right : String(left) >= String(right);
    }
    return false;
  }

  function getDocumentTagRecords(docId: DocumentId): TagRecord[] {
    const tagIds = documentTags.get(docId) ?? [];
    return tagIds.map(tid => tags.get(tid)!).filter(Boolean);
  }

  function getDocumentTags(docId: DocumentId): Tag[] {
    return getDocumentTagRecords(docId).map(({ key, value }) => ({ key, value }));
  }

  const store: DataStorePort = {
    // ─── Resolution-time reads ────────────────────────────────────────────────
    async getDocument(id: DocumentId): Promise<Result<DataDocument, DataStoreError>> {
      const record = documents.get(id);
      if (!record) return notFound();
      const docTags = getDocumentTags(id);
      if (!record.isComposition) {
        const leaf: DataLeaf = {
          type: 'leaf',
          id,
          title: record.title,
          tags: docTags,
          content: record.content ?? '',
        };
        return ok(leaf);
      }
      const slotIds = slotsByComposition.get(id) ?? [];
      const docSlots = slotIds.map(sid => slots.get(sid)!).filter(Boolean);
      const composition: DataComposition = {
        type: 'composition',
        id,
        title: record.title,
        tags: docTags,
        slots: docSlots,
      };
      return ok(composition);
    },

    async getPreset(id: PresetId): Promise<Result<Preset, DataStoreError>> {
      const record = presets.get(id);
      if (!record) return notFound();
      const rules = (presetRules.get(id) ?? []).map(r => ({
        premise: r.premise,
        action: r.action,
      }));
      const adHocDocuments = (presetAdHocDocs.get(id) ?? []).map(r => r.documentId);
      const preset: Preset = {
        id,
        name: record.name,
        baseCompositionId: record.compositionId,
        rules,
        adHocDocuments,
      };
      return ok(preset);
    },

    async getVariantGroupMembers(id: VariantGroupId): Promise<Result<DocumentId[], DataStoreError>> {
      const members = variantGroupMembers.get(id) ?? [];
      const sorted = [...members].sort((a, b) => a.memberOrder - b.memberOrder);
      return ok(sorted.map(m => m.documentId));
    },

    // ─── CRUD-time reads ──────────────────────────────────────────────────────
    async getDocumentRecord(id: DocumentId): Promise<Result<DocumentRecord, DataStoreError>> {
      const record = documents.get(id);
      if (!record) return notFound();
      return ok(record);
    },

    async listDocuments(projectId: string, filters?: DocumentFilters): Promise<Result<DocumentRecord[], DataStoreError>> {
      let results = [...documents.values()].filter(d => d.projectId === projectId);
      if (filters) {
        if (filters.isComposition !== undefined) {
          results = results.filter(d => d.isComposition === filters.isComposition);
        }
        if (filters.titleContains !== undefined) {
          const lower = filters.titleContains.toLowerCase();
          results = results.filter(d => d.title.toLowerCase().includes(lower));
        }
        if (filters.tagKey !== undefined) {
          const key = filters.tagKey;
          const value = filters.tagValue;
          results = results.filter(d => {
            const docTags = getDocumentTagRecords(d.id);
            if (value !== undefined) {
              return docTags.some(t => t.key === key && t.value === value);
            }
            return docTags.some(t => t.key === key);
          });
        }
      }
      return ok(results);
    },

    async listSlots(compositionId: DocumentId): Promise<Result<CompositionSlot[], DataStoreError>> {
      const slotIds = slotsByComposition.get(compositionId) ?? [];
      const result = slotIds.map(sid => slots.get(sid)!).filter(Boolean);
      return ok(result);
    },

    async getVariantGroup(id: VariantGroupId): Promise<Result<VariantGroupRecord, DataStoreError>> {
      const record = variantGroups.get(id);
      if (!record) return notFound();
      return ok(record);
    },

    async listVariantGroups(projectId: string): Promise<Result<VariantGroupRecord[], DataStoreError>> {
      return ok([...variantGroups.values()].filter(vg => vg.projectId === projectId));
    },

    async listVariantGroupMemberRecords(groupId: VariantGroupId): Promise<Result<VariantGroupMemberRecord[], DataStoreError>> {
      const members = [...(variantGroupMembers.get(groupId) ?? [])].sort((a, b) => a.memberOrder - b.memberOrder);
      return ok(members);
    },

    async listTagsForDocument(documentId: DocumentId): Promise<Result<TagRecord[], DataStoreError>> {
      return ok(getDocumentTagRecords(documentId));
    },

    async searchTags(projectId: string, key?: string, value?: string): Promise<Result<TagRecord[], DataStoreError>> {
      let results = [...tags.values()].filter(t => t.projectId === projectId);
      if (key !== undefined) results = results.filter(t => t.key === key);
      if (value !== undefined) results = results.filter(t => t.value === value);
      return ok(results);
    },

    async getPresetRecord(id: PresetId): Promise<Result<PresetRecord, DataStoreError>> {
      const record = presets.get(id);
      if (!record) return notFound();
      return ok(record);
    },

    async listPresets(projectId: string): Promise<Result<PresetRecord[], DataStoreError>> {
      return ok([...presets.values()].filter(p => p.projectId === projectId));
    },

    async listPresetRules(presetId: PresetId): Promise<Result<PresetRuleRecord[], DataStoreError>> {
      const rules = [...(presetRules.get(presetId) ?? [])].sort((a, b) => a.ruleOrder - b.ruleOrder);
      return ok(rules);
    },

    async listPresetAdHocDocuments(presetId: PresetId): Promise<Result<PresetAdHocDocumentRecord[], DataStoreError>> {
      const docs = [...(presetAdHocDocs.get(presetId) ?? [])].sort((a, b) => a.inclusionOrder - b.inclusionOrder);
      return ok(docs);
    },

    // ─── Predicate-pushdown query ──────────────────────────────────────────────
    async queryDocuments(projectId: string, predicates: DocumentPredicate[]): Promise<Result<DataDocument[], DataStoreError>> {
      const passing: DataDocument[] = [];
      for (const [id, record] of documents) {
        if (record.projectId !== projectId) continue;
        const docTagRecords = getDocumentTagRecords(id);
        let matches = true;
        for (const pred of predicates) {
          if (pred.type === 'is_composition') {
            if (record.isComposition !== pred.value) { matches = false; break; }
          } else {
            if (!applyTagPredicate(pred, docTagRecords)) { matches = false; break; }
          }
        }
        if (matches) {
          const docResult = await store.getDocument(id);
          if (docResult.ok) passing.push(docResult.value);
        }
      }
      return ok(passing);
    },

    // ─── Document writes ───────────────────────────────────────────────────────
    async createDocument(input: CreateDocumentInput): Promise<Result<DocumentRecord, DataStoreError>> {
      const id = crypto.randomUUID() as DocumentId;
      const now = new Date();
      const record: DocumentRecord = {
        id,
        projectId: input.projectId,
        title: input.title,
        alias: input.alias ?? null,
        isComposition: input.isComposition,
        content: input.isComposition ? null : (input.content ?? null),
        createdAt: now,
        updatedAt: now,
      };
      documents.set(id, record);
      documentTags.set(id, []);
      if (input.isComposition) {
        slotsByComposition.set(id, []);
      }
      return ok(record);
    },

    async updateDocument(id: DocumentId, input: UpdateDocumentInput): Promise<Result<DocumentRecord, DataStoreError>> {
      const record = documents.get(id);
      if (!record) return notFound();
      const updated: DocumentRecord = {
        ...record,
        title: input.title ?? record.title,
        alias: input.alias !== undefined ? input.alias : record.alias,
        isComposition: input.isComposition ?? record.isComposition,
        content: input.content !== undefined ? input.content : record.content,
        updatedAt: new Date(),
      };
      documents.set(id, updated);
      if (updated.isComposition && !slotsByComposition.has(id)) {
        slotsByComposition.set(id, []);
      }
      return ok(updated);
    },

    async deleteDocument(id: DocumentId): Promise<Result<void, DataStoreError>> {
      if (!documents.has(id)) return notFound();
      documents.delete(id);
      documentTags.delete(id);
      slotsByComposition.delete(id);
      return ok(undefined);
    },

    // ─── Slot writes ───────────────────────────────────────────────────────────
    async createSlot(compositionId: DocumentId, input: CreateSlotInput): Promise<Result<CompositionSlot, DataStoreError>> {
      const slotId = crypto.randomUUID() as SlotId;
      const existing = slotsByComposition.get(compositionId) ?? [];
      const slotOrder = existing.length;
      const slot: CompositionSlot = {
        id: slotId,
        compositionId,
        slotOrder,
        referenceType: input.referenceType,
        referenceDocumentId: input.referenceDocumentId,
        referenceVariantGroupId: input.referenceVariantGroupId,
      };
      slots.set(slotId, slot);
      slotsByComposition.set(compositionId, [...existing, slotId]);
      return ok(slot);
    },

    async deleteSlot(slotId: SlotId): Promise<Result<void, DataStoreError>> {
      const slot = slots.get(slotId);
      if (!slot) return notFound();
      slots.delete(slotId);
      const compositionSlots = slotsByComposition.get(slot.compositionId) ?? [];
      const updated = compositionSlots.filter(sid => sid !== slotId);
      slotsByComposition.set(slot.compositionId, updated);
      // Re-sequence slot orders
      updated.forEach((sid, idx) => {
        const s = slots.get(sid);
        if (s) slots.set(sid, { ...s, slotOrder: idx });
      });
      return ok(undefined);
    },

    async reorderSlots(compositionId: DocumentId, orderedSlotIds: SlotId[]): Promise<Result<void, DataStoreError>> {
      slotsByComposition.set(compositionId, [...orderedSlotIds]);
      orderedSlotIds.forEach((sid, idx) => {
        const s = slots.get(sid);
        if (s) slots.set(sid, { ...s, slotOrder: idx });
      });
      return ok(undefined);
    },

    // ─── Variant group writes ──────────────────────────────────────────────────
    async createVariantGroup(input: CreateVariantGroupInput): Promise<Result<VariantGroupRecord, DataStoreError>> {
      const id = crypto.randomUUID() as VariantGroupId;
      const record: VariantGroupRecord = {
        id,
        projectId: input.projectId,
        name: input.name,
        createdAt: new Date(),
      };
      variantGroups.set(id, record);
      variantGroupMembers.set(id, []);
      return ok(record);
    },

    async deleteVariantGroup(id: VariantGroupId): Promise<Result<void, DataStoreError>> {
      if (!variantGroups.has(id)) return notFound();
      variantGroups.delete(id);
      variantGroupMembers.delete(id);
      return ok(undefined);
    },

    async addVariantGroupMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<VariantGroupMemberRecord, DataStoreError>> {
      const members = variantGroupMembers.get(groupId) ?? [];
      const memberOrder = members.length;
      const record: VariantGroupMemberRecord = {
        variantGroupId: groupId,
        documentId,
        memberOrder,
        createdAt: new Date(),
      };
      variantGroupMembers.set(groupId, [...members, record]);
      return ok(record);
    },

    async removeVariantGroupMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<void, DataStoreError>> {
      const members = variantGroupMembers.get(groupId) ?? [];
      const filtered = members.filter(m => m.documentId !== documentId);
      // Re-index
      const reindexed = filtered.map((m, idx) => ({ ...m, memberOrder: idx }));
      variantGroupMembers.set(groupId, reindexed);
      return ok(undefined);
    },

    async reorderVariantGroupMembers(groupId: VariantGroupId, orderedDocumentIds: DocumentId[]): Promise<Result<void, DataStoreError>> {
      const members = variantGroupMembers.get(groupId) ?? [];
      const memberMap = new Map(members.map(m => [m.documentId, m]));
      const reordered = orderedDocumentIds.map((did, idx) => ({
        ...memberMap.get(did)!,
        memberOrder: idx,
      }));
      variantGroupMembers.set(groupId, reordered);
      return ok(undefined);
    },

    // ─── Tag writes ────────────────────────────────────────────────────────────
    async assignTag(documentId: DocumentId, key: string, value: string): Promise<Result<TagRecord, DataStoreError>> {
      const docRecord = documents.get(documentId);
      if (!docRecord) return notFound();
      const projectId = docRecord.projectId;

      // Find or create tag record
      let tagRecord = [...tags.values()].find(t => t.projectId === projectId && t.key === key && t.value === value);
      if (!tagRecord) {
        const tagId = crypto.randomUUID() as TagId;
        tagRecord = {
          id: tagId,
          projectId,
          key,
          value,
          color: '#6366f1',
          createdAt: new Date(),
        };
        tags.set(tagId, tagRecord);
      }

      // Add to document's tag list if not already there
      const docTagIds = documentTags.get(documentId) ?? [];
      if (!docTagIds.includes(tagRecord.id)) {
        documentTags.set(documentId, [...docTagIds, tagRecord.id]);
      }

      return ok(tagRecord);
    },

    async removeTag(documentId: DocumentId, tagId: TagId): Promise<Result<void, DataStoreError>> {
      const docTagIds = documentTags.get(documentId) ?? [];
      if (!docTagIds.includes(tagId)) return notFound();
      documentTags.set(documentId, docTagIds.filter(tid => tid !== tagId));
      // Also remove the tag record itself if no document uses it
      const stillUsed = [...documentTags.values()].some(ids => ids.includes(tagId));
      if (!stillUsed) tags.delete(tagId);
      return ok(undefined);
    },

    // ─── Preset writes ─────────────────────────────────────────────────────────
    async createPreset(input: CreatePresetInput): Promise<Result<PresetRecord, DataStoreError>> {
      const id = crypto.randomUUID() as PresetId;
      const now = new Date();
      const record: PresetRecord = {
        id,
        projectId: input.projectId,
        name: input.name,
        compositionId: input.compositionId,
        createdAt: now,
        updatedAt: now,
      };
      presets.set(id, record);
      presetRules.set(id, []);
      presetAdHocDocs.set(id, []);
      return ok(record);
    },

    async updatePreset(id: PresetId, input: UpdatePresetInput): Promise<Result<PresetRecord, DataStoreError>> {
      const record = presets.get(id);
      if (!record) return notFound();
      const updated: PresetRecord = {
        ...record,
        name: input.name ?? record.name,
        compositionId: input.compositionId ?? record.compositionId,
        updatedAt: new Date(),
      };
      presets.set(id, updated);
      return ok(updated);
    },

    async deletePreset(id: PresetId): Promise<Result<void, DataStoreError>> {
      if (!presets.has(id)) return notFound();
      presets.delete(id);
      presetRules.delete(id);
      presetAdHocDocs.delete(id);
      return ok(undefined);
    },

    async addPresetRule(presetId: PresetId, input: AddPresetRuleInput): Promise<Result<PresetRuleRecord, DataStoreError>> {
      const rules = presetRules.get(presetId) ?? [];
      const ruleOrder = rules.length;
      const record: PresetRuleRecord = {
        id: crypto.randomUUID(),
        presetId,
        ruleOrder,
        premise: input.premise,
        action: input.action,
        description: input.description ?? null,
      };
      presetRules.set(presetId, [...rules, record]);
      return ok(record);
    },

    async removePresetRule(presetId: PresetId, ruleId: string): Promise<Result<void, DataStoreError>> {
      const rules = presetRules.get(presetId) ?? [];
      const idx = rules.findIndex(r => r.id === ruleId);
      if (idx === -1) return notFound();
      const filtered = rules.filter(r => r.id !== ruleId);
      const reindexed = filtered.map((r, i) => ({ ...r, ruleOrder: i }));
      presetRules.set(presetId, reindexed);
      return ok(undefined);
    },

    async reorderPresetRules(presetId: PresetId, orderedRuleIds: string[]): Promise<Result<void, DataStoreError>> {
      const rules = presetRules.get(presetId) ?? [];
      const ruleMap = new Map(rules.map(r => [r.id, r]));
      const reordered = orderedRuleIds.map((rid, idx) => ({ ...ruleMap.get(rid)!, ruleOrder: idx }));
      presetRules.set(presetId, reordered);
      return ok(undefined);
    },

    async addPresetAdHocDocument(presetId: PresetId, documentId: DocumentId): Promise<Result<PresetAdHocDocumentRecord, DataStoreError>> {
      const docs = presetAdHocDocs.get(presetId) ?? [];
      const inclusionOrder = docs.length;
      const record: PresetAdHocDocumentRecord = {
        presetId,
        documentId,
        inclusionOrder,
      };
      presetAdHocDocs.set(presetId, [...docs, record]);
      return ok(record);
    },

    async removePresetAdHocDocument(presetId: PresetId, documentId: DocumentId): Promise<Result<void, DataStoreError>> {
      const docs = presetAdHocDocs.get(presetId) ?? [];
      const filtered = docs.filter(d => d.documentId !== documentId);
      const reindexed = filtered.map((d, i) => ({ ...d, inclusionOrder: i }));
      presetAdHocDocs.set(presetId, reindexed);
      return ok(undefined);
    },

    async reorderPresetAdHocDocuments(presetId: PresetId, orderedDocumentIds: DocumentId[]): Promise<Result<void, DataStoreError>> {
      const docs = presetAdHocDocs.get(presetId) ?? [];
      const docMap = new Map(docs.map(d => [d.documentId, d]));
      const reordered = orderedDocumentIds.map((did, idx) => ({ ...docMap.get(did)!, inclusionOrder: idx }));
      presetAdHocDocs.set(presetId, reordered);
      return ok(undefined);
    },
  };

  return store;
}
