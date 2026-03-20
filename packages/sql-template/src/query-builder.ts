/**
 * SQL Query Builder - generates parameterized SQL for all CRUD operations.
 */

import {
  DocumentId, SlotId, VariantGroupId, PresetId, TagId,
  CreateDocumentInput, UpdateDocumentInput, DocumentFilters,
} from '@eunoistoria/types';

export interface QuerySpec {
  sql: string;
  params: unknown[];
}

interface CreateDocInput {
  id: DocumentId;
  projectId: string;
  title: string;
  isComposition: boolean;
  content?: string | null;
  alias?: string | null;
}

interface UpdateDocInput {
  title?: string;
  alias?: string | null;
  content?: string | null;
  isComposition?: boolean;
}

interface CreateSlotInput {
  id: SlotId;
  compositionId: DocumentId;
  slotOrder: number;
  referenceType: 'document' | 'variant_group';
  referenceDocumentId?: DocumentId;
  referenceVariantGroupId?: VariantGroupId;
}

interface CreateVgInput {
  id: VariantGroupId;
  projectId: string;
  name: string;
}

interface CreatePresetInput {
  id: PresetId;
  projectId: string;
  name: string;
  baseCompositionId: DocumentId;
}

interface PresetRuleInput {
  premise: unknown; // JSON
  actionParams: unknown; // JSON
}

export class QueryBuilder {
  constructor(private placeholderStyle: '?' | '$') {}

  private getPlaceholder(index: number): string {
    if (this.placeholderStyle === '?') return '?';
    return `$${index + 1}`;
  }

  private buildPlaceholders(count: number): string[] {
    return Array.from({ length: count }, (_, i) => this.getPlaceholder(i));
  }

  // ============================================================================
  // Document Queries
  // ============================================================================

  buildGetDocument(id: DocumentId): QuerySpec {
    const sql = `
      SELECT d.*, json_group_array(json_object('key', t.key, 'value', t.value)) as tags
      FROM documents d
      LEFT JOIN document_tags dt ON d.id = dt.document_id
      LEFT JOIN tags t ON dt.tag_id = t.id
      WHERE d.id = ?
      GROUP BY d.id
    `;
    return {
      sql: sql.replace(/\?/g, () => this.getPlaceholder(0)),
      params: [id],
    };
  }

  buildListDocuments(projectId: string, filters: Record<string, unknown> = {}): QuerySpec {
    let sql = 'SELECT * FROM documents WHERE project_id = ?';
    const params: unknown[] = [projectId];

    if (filters.isComposition !== undefined) {
      sql += ` AND is_composition = ?`;
      params.push(filters.isComposition ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC';

    // Replace placeholders with dialect-specific style
    let placeholderIndex = 0;
    sql = sql.replace(/\?/g, () => this.getPlaceholder(placeholderIndex++));

    return { sql, params };
  }

  buildCreateDocument(input: CreateDocInput): QuerySpec {
    const now = new Date().toISOString();
    const placeholders = this.buildPlaceholders(8);

    const sql = `
      INSERT INTO documents (id, project_id, title, alias, is_composition, content, created_at, updated_at)
      VALUES (${placeholders.join(', ')})
    `;

    return {
      sql,
      params: [
        input.id,
        input.projectId,
        input.title,
        input.alias || null,
        input.isComposition ? 1 : 0,
        input.content || null,
        now,
        now,
      ],
    };
  }

  buildUpdateDocument(id: DocumentId, changes: UpdateDocInput): QuerySpec {
    const updates: string[] = [];
    const params: unknown[] = [];
    let placeholderIndex = 0;

    if (changes.title !== undefined) {
      updates.push(`title = ${this.getPlaceholder(placeholderIndex++)}`);
      params.push(changes.title);
    }
    if (changes.alias !== undefined) {
      updates.push(`alias = ${this.getPlaceholder(placeholderIndex++)}`);
      params.push(changes.alias);
    }
    if (changes.content !== undefined) {
      updates.push(`content = ${this.getPlaceholder(placeholderIndex++)}`);
      params.push(changes.content);
    }
    if (changes.isComposition !== undefined) {
      updates.push(`is_composition = ${this.getPlaceholder(placeholderIndex++)}`);
      params.push(changes.isComposition ? 1 : 0);
    }

    updates.push(`updated_at = ${this.getPlaceholder(placeholderIndex++)}`);
    params.push(new Date().toISOString());

    params.push(id);

    const sql = `
      UPDATE documents
      SET ${updates.join(', ')}
      WHERE id = ${this.getPlaceholder(placeholderIndex)}
    `;

    return { sql, params };
  }

  buildDeleteDocument(id: DocumentId): QuerySpec {
    return {
      sql: 'DELETE FROM documents WHERE id = ?'.replace('?', this.getPlaceholder(0)),
      params: [id],
    };
  }

  // ============================================================================
  // Slot Queries
  // ============================================================================

  buildListSlots(compositionId: DocumentId): QuerySpec {
    const sql = `
      SELECT * FROM composition_slots
      WHERE composition_id = ?
      ORDER BY slot_order ASC
    `.replace('?', this.getPlaceholder(0));

    return { sql, params: [compositionId] };
  }

  buildCreateSlot(input: CreateSlotInput): QuerySpec {
    const now = new Date().toISOString();
    const placeholders = this.buildPlaceholders(7);

    const sql = `
      INSERT INTO composition_slots (id, composition_id, slot_order, reference_type, reference_document_id, reference_variant_group_id, created_at)
      VALUES (${placeholders.join(', ')})
    `;

    return {
      sql,
      params: [
        input.id,
        input.compositionId,
        input.slotOrder,
        input.referenceType,
        input.referenceDocumentId || null,
        input.referenceVariantGroupId || null,
        now,
      ],
    };
  }

  buildDeleteSlot(slotId: SlotId): QuerySpec {
    return {
      sql: 'DELETE FROM composition_slots WHERE id = ?'.replace('?', this.getPlaceholder(0)),
      params: [slotId],
    };
  }

  buildReorderSlots(compositionId: DocumentId, slotIds: SlotId[]): QuerySpec {
    // Simplified: could use CASE statement or multiple UPDATEs
    // For MVP, generate individual updates
    const updates: string[] = [];
    const params: unknown[] = [];
    let placeholderIndex = 0;

    for (let order = 0; order < slotIds.length; order++) {
      updates.push(
        `UPDATE composition_slots SET slot_order = ${this.getPlaceholder(placeholderIndex++)} WHERE id = ${this.getPlaceholder(placeholderIndex++)}`
      );
      params.push(order);
      params.push(slotIds[order]);
    }

    return {
      sql: updates.join('; '),
      params,
    };
  }

  // ============================================================================
  // Variant Group Queries
  // ============================================================================

  buildListVariantGroups(projectId: string): QuerySpec {
    const sql = `
      SELECT * FROM variant_groups
      WHERE project_id = ?
      ORDER BY created_at DESC
    `.replace('?', this.getPlaceholder(0));

    return { sql, params: [projectId] };
  }

  buildCreateVariantGroup(input: CreateVgInput): QuerySpec {
    const now = new Date().toISOString();
    const placeholders = this.buildPlaceholders(4);

    const sql = `
      INSERT INTO variant_groups (id, project_id, name, created_at)
      VALUES (${placeholders.join(', ')})
    `;

    return {
      sql,
      params: [input.id, input.projectId, input.name, now],
    };
  }

  buildDeleteVariantGroup(groupId: VariantGroupId): QuerySpec {
    return {
      sql: 'DELETE FROM variant_groups WHERE id = ?'.replace('?', this.getPlaceholder(0)),
      params: [groupId],
    };
  }

  buildListVariantGroupMembers(groupId: VariantGroupId): QuerySpec {
    const sql = `
      SELECT document_id FROM variant_group_members
      WHERE variant_group_id = ?
      ORDER BY member_order ASC
    `.replace('?', this.getPlaceholder(0));

    return { sql, params: [groupId] };
  }

  buildAddMember(groupId: VariantGroupId, documentId: DocumentId, memberOrder: number): QuerySpec {
    const now = new Date().toISOString();
    const placeholders = this.buildPlaceholders(4);

    const sql = `
      INSERT INTO variant_group_members (variant_group_id, document_id, member_order, created_at)
      VALUES (${placeholders.join(', ')})
    `;

    return {
      sql,
      params: [groupId, documentId, memberOrder, now],
    };
  }

  buildRemoveMember(groupId: VariantGroupId, documentId: DocumentId): QuerySpec {
    let sql = `DELETE FROM variant_group_members WHERE variant_group_id = ? AND document_id = ?`;
    let placeholderIndex = 0;
    sql = sql.replace(/\?/g, () => this.getPlaceholder(placeholderIndex++));

    return {
      sql,
      params: [groupId, documentId],
    };
  }

  buildReorderMembers(groupId: VariantGroupId, documentIds: DocumentId[]): QuerySpec {
    const updates: string[] = [];
    const params: unknown[] = [];
    let placeholderIndex = 0;

    for (let order = 0; order < documentIds.length; order++) {
      updates.push(
        `UPDATE variant_group_members SET member_order = ${this.getPlaceholder(placeholderIndex++)} WHERE variant_group_id = ${this.getPlaceholder(placeholderIndex++)} AND document_id = ${this.getPlaceholder(placeholderIndex++)}`
      );
      params.push(order);
      params.push(groupId);
      params.push(documentIds[order]);
    }

    return {
      sql: updates.join('; '),
      params,
    };
  }

  // ============================================================================
  // Tag Queries
  // ============================================================================

  buildSearchTags(projectId: string, key?: string, value?: string): QuerySpec {
    let sql = 'SELECT * FROM tags WHERE project_id = ?';
    const params: unknown[] = [projectId];
    let placeholderIndex = 1;

    if (key !== undefined) {
      sql += ` AND key = ${this.getPlaceholder(placeholderIndex++)}`;
      params.push(key);
    }

    if (value !== undefined) {
      sql += ` AND value = ${this.getPlaceholder(placeholderIndex++)}`;
      params.push(value);
    }

    // Re-index placeholders
    let finalIndex = 0;
    sql = sql.replace(/\?/g, () => {
      if (finalIndex === 0) {
        finalIndex++;
        return this.getPlaceholder(0);
      }
      return this.getPlaceholder(finalIndex++);
    });

    return { sql, params };
  }

  buildGetTagsForDocument(documentId: DocumentId): QuerySpec {
    const sql = `
      SELECT t.* FROM tags t
      JOIN document_tags dt ON t.id = dt.tag_id
      WHERE dt.document_id = ?
    `.replace('?', this.getPlaceholder(0));

    return { sql, params: [documentId] };
  }

  buildAssignTag(documentId: DocumentId, key: string, value: string): QuerySpec {
    const tagId = `tag_${Date.now()}_${Math.random()}`;
    const now = new Date().toISOString();
    let sql = `
      INSERT INTO tags (id, project_id, key, value, created_at)
      SELECT ?, (SELECT project_id FROM documents WHERE id = ?), ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM tags WHERE key = ? AND value = ?);

      INSERT INTO document_tags (document_id, tag_id)
      SELECT ?, t.id FROM tags t WHERE t.key = ? AND t.value = ?
      AND NOT EXISTS (SELECT 1 FROM document_tags WHERE document_id = ? AND tag_id = t.id)
    `;

    let placeholderIndex = 0;
    sql = sql.replace(/\?/g, () => this.getPlaceholder(placeholderIndex++));

    return {
      sql,
      params: [tagId, documentId, key, value, now, key, value, documentId, key, value, documentId],
    };
  }

  buildRemoveTag(tagId: TagId): QuerySpec {
    return {
      sql: 'DELETE FROM tags WHERE id = ?'.replace('?', this.getPlaceholder(0)),
      params: [tagId],
    };
  }

  // ============================================================================
  // Preset Queries
  // ============================================================================

  buildCreatePreset(input: CreatePresetInput): QuerySpec {
    const now = new Date().toISOString();
    const placeholders = this.buildPlaceholders(5);

    const sql = `
      INSERT INTO presets (id, project_id, name, base_composition_id, created_at, updated_at)
      VALUES (${placeholders.join(', ')}, ${this.getPlaceholder(5)})
    `;

    return {
      sql,
      params: [input.id, input.projectId, input.name, input.baseCompositionId, now, now],
    };
  }

  buildAddPresetRule(presetId: PresetId, ruleOrder: number, rule: PresetRuleInput): QuerySpec {
    const ruleId = `rule_${Date.now()}_${Math.random()}`;
    const now = new Date().toISOString();
    const placeholders = this.buildPlaceholders(7);

    const sql = `
      INSERT INTO preset_rules (id, preset_id, rule_order, premise, action_params, created_at)
      VALUES (${placeholders.join(', ')})
    `;

    return {
      sql,
      params: [
        ruleId,
        presetId,
        ruleOrder,
        JSON.stringify(rule.premise),
        JSON.stringify(rule.actionParams),
        now,
      ],
    };
  }

  buildListPresetRules(presetId: PresetId): QuerySpec {
    const sql = `
      SELECT * FROM preset_rules
      WHERE preset_id = ?
      ORDER BY rule_order ASC
    `.replace('?', this.getPlaceholder(0));

    return { sql, params: [presetId] };
  }

  buildRemovePresetRule(ruleId: string): QuerySpec {
    return {
      sql: 'DELETE FROM preset_rules WHERE id = ?'.replace('?', this.getPlaceholder(0)),
      params: [ruleId],
    };
  }

  buildAddAdHocDocument(presetId: PresetId, documentId: DocumentId, inclusionOrder: number): QuerySpec {
    const placeholders = this.buildPlaceholders(3);

    const sql = `
      INSERT INTO preset_ad_hoc_documents (preset_id, document_id, inclusion_order)
      VALUES (${placeholders.join(', ')})
    `;

    return {
      sql,
      params: [presetId, documentId, inclusionOrder],
    };
  }

  buildRemoveAdHocDocument(presetId: PresetId, documentId: DocumentId): QuerySpec {
    let sql = `DELETE FROM preset_ad_hoc_documents WHERE preset_id = ? AND document_id = ?`;
    let placeholderIndex = 0;
    sql = sql.replace(/\?/g, () => this.getPlaceholder(placeholderIndex++));

    return {
      sql,
      params: [presetId, documentId],
    };
  }
}
