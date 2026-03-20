/**
 * SQLite DataStore - implements DataStorePort for SQLite
 */

import {
  Result, DataStoreError,
  DocumentId, SlotId, VariantGroupId, PresetId, TagId,
  CreateDocumentInput, UpdateDocumentInput, DocumentFilters,
  DocumentRecord,
} from '../../types/src/index';
import { MigrationManager } from '../../sql-template/src/index';
import { SqliteConnection } from './connection.js';

export class SqliteDataStore {
  private connection: SqliteConnection;
  private migrationManager: MigrationManager;

  constructor(dbPath: string = 'eunoistoria.db') {
    this.connection = new SqliteConnection(dbPath);
    this.migrationManager = new MigrationManager();
  }

  async initialize(): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.open();
      const result = await this.migrationManager.runMigrations(this.connection as any, 1);
      if (!result.ok) {
        return { ok: false, error: DataStoreError.ConnectionFailed };
      }
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.ConnectionFailed };
    }
  }

  async close(): Promise<void> {
    await this.connection.close();
  }

  async createDocument(input: CreateDocumentInput): Promise<Result<DocumentRecord, DataStoreError>> {
    try {
      const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as DocumentId;
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO documents (id, project_id, title, alias, is_composition, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.connection.executeUpdate(sql, [
        id,
        input.projectId,
        input.title,
        input.alias || null,
        input.isComposition ? 1 : 0,
        input.content || null,
        now,
        now,
      ]);

      return {
        ok: true,
        value: {
          id,
          projectId: input.projectId,
          title: input.title,
          alias: input.alias || null,
          isComposition: input.isComposition,
          content: input.content || null,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        },
      };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async getDocument(id: DocumentId): Promise<Result<DocumentRecord, DataStoreError>> {
    try {
      const rows = await this.connection.execute('SELECT * FROM documents WHERE id = ?', [id]);

      if (rows.length === 0) {
        return { ok: false, error: DataStoreError.NotFound };
      }

      const row = rows[0] as any;
      return {
        ok: true,
        value: {
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          alias: row.alias,
          isComposition: row.is_composition === 1,
          content: row.content,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        },
      };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async updateDocument(id: DocumentId, changes: UpdateDocumentInput): Promise<Result<DocumentRecord, DataStoreError>> {
    try {
      const updates: string[] = [];
      const params: unknown[] = [];

      if (changes.title !== undefined) {
        updates.push('title = ?');
        params.push(changes.title);
      }
      if (changes.alias !== undefined) {
        updates.push('alias = ?');
        params.push(changes.alias);
      }
      if (changes.content !== undefined) {
        updates.push('content = ?');
        params.push(changes.content);
      }
      if (changes.isComposition !== undefined) {
        updates.push('is_composition = ?');
        params.push(changes.isComposition ? 1 : 0);
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      const sql = `UPDATE documents SET ${updates.join(', ')} WHERE id = ?`;
      await this.connection.executeUpdate(sql, params);

      // Fetch and return updated document
      return this.getDocument(id);
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async deleteDocument(id: DocumentId): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.executeUpdate('DELETE FROM documents WHERE id = ?', [id]);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async listDocuments(projectId: string, filters?: DocumentFilters): Promise<Result<DocumentRecord[], DataStoreError>> {
    try {
      let sql = 'SELECT * FROM documents WHERE project_id = ?';
      const params: unknown[] = [projectId];

      if (filters?.isComposition !== undefined) {
        sql += ' AND is_composition = ?';
        params.push(filters.isComposition ? 1 : 0);
      }

      if (filters?.titleContains !== undefined) {
        sql += ' AND (LOWER(title) LIKE LOWER(?) OR LOWER(alias) LIKE LOWER(?))';
        const pattern = `%${filters.titleContains}%`;
        params.push(pattern, pattern);
      }

      if (filters?.titleContains !== undefined) {
        sql += ' ORDER BY CASE WHEN LOWER(title) LIKE LOWER(?) THEN 0 ELSE 1 END ASC, created_at DESC';
        const pattern = `%${filters.titleContains}%`;
        params.push(pattern);
      } else {
        sql += ' ORDER BY created_at DESC';
      }

      const rows = await this.connection.execute(sql, params);
      const documents = (rows as any[]).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        alias: row.alias,
        isComposition: row.is_composition === 1,
        content: row.content,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));

      return { ok: true, value: documents };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async createSlot(compositionId: DocumentId, input: any): Promise<Result<any, DataStoreError>> {
    try {
      const id = `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as SlotId;
      const now = new Date().toISOString();

      // Get next slot order
      const orderRows = await this.connection.execute(
        'SELECT MAX(slot_order) as max_order FROM composition_slots WHERE composition_id = ?',
        [compositionId]
      );

      const slotOrder = ((orderRows[0] as any)?.max_order ?? -1) + 1;

      const sql = `
        INSERT INTO composition_slots (id, composition_id, slot_order, reference_type, reference_document_id, reference_variant_group_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await this.connection.executeUpdate(sql, [
        id,
        compositionId,
        slotOrder,
        input.referenceType,
        input.referenceDocumentId || null,
        input.referenceVariantGroupId || null,
        now,
      ]);

      return {
        ok: true,
        value: {
          id,
          compositionId,
          slotOrder,
          referenceType: input.referenceType,
          referenceDocumentId: input.referenceDocumentId,
          referenceVariantGroupId: input.referenceVariantGroupId,
        },
      };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async listSlots(compositionId: DocumentId): Promise<Result<any[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(
        'SELECT * FROM composition_slots WHERE composition_id = ? ORDER BY slot_order ASC',
        [compositionId]
      );

      const slots = (rows as any[]).map(row => ({
        id: row.id,
        compositionId: row.composition_id,
        slotOrder: row.slot_order,
        referenceType: row.reference_type,
        referenceDocumentId: row.reference_document_id,
        referenceVariantGroupId: row.reference_variant_group_id,
      }));

      return { ok: true, value: slots };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async deleteSlot(slotId: SlotId): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.executeUpdate('DELETE FROM composition_slots WHERE id = ?', [slotId]);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async createVariantGroup(input: any): Promise<Result<any, DataStoreError>> {
    try {
      const id = `vg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as VariantGroupId;
      const now = new Date().toISOString();

      await this.connection.executeUpdate(
        'INSERT INTO variant_groups (id, project_id, name, created_at) VALUES (?, ?, ?, ?)',
        [id, input.projectId, input.name, now]
      );

      return {
        ok: true,
        value: { id, projectId: input.projectId, name: input.name },
      };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async addMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<any, DataStoreError>> {
    try {
      const orderRows = await this.connection.execute(
        'SELECT MAX(member_order) as max_order FROM variant_group_members WHERE variant_group_id = ?',
        [groupId]
      );

      const memberOrder = ((orderRows[0] as any)?.max_order ?? -1) + 1;
      const now = new Date().toISOString();

      await this.connection.executeUpdate(
        'INSERT INTO variant_group_members (variant_group_id, document_id, member_order, created_at) VALUES (?, ?, ?, ?)',
        [groupId, documentId, memberOrder, now]
      );

      return { ok: true, value: { groupId, documentId, memberOrder } };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async getVariantGroupMembers(groupId: VariantGroupId): Promise<Result<DocumentId[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(
        'SELECT document_id FROM variant_group_members WHERE variant_group_id = ? ORDER BY member_order ASC',
        [groupId]
      );

      const members = (rows as any[]).map(row => row.document_id as DocumentId);
      return { ok: true, value: members };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async assignTag(documentId: DocumentId, key: string, value: string): Promise<Result<any, DataStoreError>> {
    try {
      return await this.connection.transaction(async (tx) => {
        // Find or create tag
        const tagRows = await (tx as any).execute(
          'SELECT id FROM tags WHERE project_id = (SELECT project_id FROM documents WHERE id = ?) AND key = ? AND value = ?',
          [documentId, key, value]
        );

        let tagId: TagId;
        if (tagRows.length > 0) {
          tagId = (tagRows[0] as any).id;
        } else {
          tagId = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as TagId;
          const now = new Date().toISOString();

          const projectRows = await (tx as any).execute('SELECT project_id FROM documents WHERE id = ?', [documentId]);
          const projectId = (projectRows[0] as any).project_id;

          await (tx as any).executeUpdate(
            'INSERT INTO tags (id, project_id, key, value, created_at) VALUES (?, ?, ?, ?, ?)',
            [tagId, projectId, key, value, now]
          );
        }

        // Assign to document
        await (tx as any).executeUpdate(
          'INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)',
          [documentId, tagId]
        );

        return { ok: true, value: { id: tagId, key, value } };
      });
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async getTagsForDocument(documentId: DocumentId): Promise<Result<any[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(
        'SELECT t.* FROM tags t JOIN document_tags dt ON t.id = dt.tag_id WHERE dt.document_id = ?',
        [documentId]
      );

      const tags = (rows as any[]).map(row => ({ id: row.id, key: row.key, value: row.value }));
      return { ok: true, value: tags };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async searchTags(projectId: string, key?: string, value?: string): Promise<Result<any[], DataStoreError>> {
    try {
      let sql = 'SELECT * FROM tags WHERE project_id = ?';
      const params: unknown[] = [projectId];

      if (key) {
        sql += ' AND key = ?';
        params.push(key);
      }
      if (value) {
        sql += ' AND value = ?';
        params.push(value);
      }

      const rows = await this.connection.execute(sql, params);
      const tags = (rows as any[]).map(row => ({ id: row.id, key: row.key, value: row.value }));
      return { ok: true, value: tags };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async createPreset(input: any): Promise<Result<any, DataStoreError>> {
    try {
      const id = `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as PresetId;
      const now = new Date().toISOString();

      await this.connection.executeUpdate(
        'INSERT INTO presets (id, project_id, name, base_composition_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, input.projectId, input.name, input.baseCompositionId, now, now]
      );

      return {
        ok: true,
        value: { id, projectId: input.projectId, name: input.name, baseCompositionId: input.baseCompositionId },
      };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async addPresetRule(presetId: PresetId, input: any): Promise<Result<any, DataStoreError>> {
    try {
      const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const orderRows = await this.connection.execute(
        'SELECT MAX(rule_order) as max_order FROM preset_rules WHERE preset_id = ?',
        [presetId]
      );

      const ruleOrder = ((orderRows[0] as any)?.max_order ?? -1) + 1;
      const now = new Date().toISOString();

      await this.connection.executeUpdate(
        'INSERT INTO preset_rules (id, preset_id, rule_order, premise, action_params, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, presetId, ruleOrder, JSON.stringify(input.premise), JSON.stringify(input.actionParams), now]
      );

      return { ok: true, value: { id, ruleOrder } };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<Result<T, DataStoreError>> {
    try {
      const result = await this.connection.transaction(async () => fn(this));
      return { ok: true, value: result };
    } catch (error) {
      return { ok: false, error: DataStoreError.TransactionFailed };
    }
  }

  // Additional methods required by DataStorePort but not fully implemented yet
  async getDocumentRecord(id: DocumentId): Promise<Result<any, DataStoreError>> {
    return this.getDocument(id);
  }

  async getVariantGroup(id: VariantGroupId): Promise<Result<any, DataStoreError>> {
    try {
      const rows = await this.connection.execute('SELECT * FROM variant_groups WHERE id = ?', [id]);
      if (rows.length === 0) return { ok: false, error: DataStoreError.NotFound };
      return { ok: true, value: rows[0] };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async listVariantGroupMemberRecords(id: VariantGroupId): Promise<Result<any[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(
        'SELECT * FROM variant_group_members WHERE variant_group_id = ? ORDER BY member_order ASC',
        [id]
      );
      return { ok: true, value: rows as any[] };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async getPreset(id: PresetId): Promise<Result<any, DataStoreError>> {
    try {
      const rows = await this.connection.execute('SELECT * FROM presets WHERE id = ?', [id]);
      if (rows.length === 0) return { ok: false, error: DataStoreError.NotFound };
      const preset = rows[0] as any;
      return {
        ok: true,
        value: {
          id: preset.id,
          name: preset.name,
          baseCompositionId: preset.base_composition_id,
          rules: [],
          adHocDocuments: [],
        },
      };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async getPresetRecord(id: PresetId): Promise<Result<any, DataStoreError>> {
    return this.getPreset(id);
  }

  async listPresetRules(id: PresetId): Promise<Result<any[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(
        'SELECT * FROM preset_rules WHERE preset_id = ? ORDER BY rule_order ASC',
        [id]
      );
      return { ok: true, value: rows as any[] };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async execute(sql: string, params: unknown[]): Promise<Result<any[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(sql, params);
      return { ok: true, value: rows };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async executeUpdate(sql: string, params: unknown[]): Promise<Result<{ changedRows: number }, DataStoreError>> {
    try {
      const result = await this.connection.executeUpdate(sql, params);
      return { ok: true, value: result };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  // Additional stub methods required by DataStorePort (not yet fully implemented)
  async listVariantGroups(projectId: string): Promise<Result<any[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(
        'SELECT * FROM variant_groups WHERE project_id = ? ORDER BY id',
        [projectId]
      );
      return { ok: true, value: rows };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async listTagsForDocument(documentId: DocumentId): Promise<Result<any[], DataStoreError>> {
    return this.getTagsForDocument(documentId);
  }

  async listPresets(projectId: string): Promise<Result<any[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(
        'SELECT * FROM presets WHERE project_id = ? ORDER BY id',
        [projectId]
      );
      return { ok: true, value: rows };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async listPresetAdHocDocuments(presetId: PresetId): Promise<Result<any[], DataStoreError>> {
    try {
      const rows = await this.connection.execute(
        'SELECT * FROM preset_ad_hoc_documents WHERE preset_id = ? ORDER BY inclusion_order',
        [presetId]
      );
      return { ok: true, value: rows };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async queryDocuments(projectId: string, predicates: any[]): Promise<Result<any[], DataStoreError>> {
    // TODO: Implement predicate-based document querying
    try {
      const rows = await this.connection.execute(
        'SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC',
        [projectId]
      );
      return { ok: true, value: rows };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async reorderSlots(compositionId: DocumentId, orderedSlotIds: SlotId[]): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.transaction(async (tx) => {
        for (let i = 0; i < orderedSlotIds.length; i++) {
          await (tx as any).executeUpdate(
            'UPDATE composition_slots SET slot_order = ? WHERE id = ?',
            [i, orderedSlotIds[i]]
          );
        }
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async deleteVariantGroup(id: VariantGroupId): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.executeUpdate('DELETE FROM variant_groups WHERE id = ?', [id]);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async removeVariantGroupMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.executeUpdate(
        'DELETE FROM variant_group_members WHERE variant_group_id = ? AND document_id = ?',
        [groupId, documentId]
      );
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async addVariantGroupMember(groupId: VariantGroupId, documentId: DocumentId): Promise<Result<any, DataStoreError>> {
    return this.addMember(groupId, documentId);
  }

  async reorderVariantGroupMembers(groupId: VariantGroupId, orderedDocumentIds: DocumentId[]): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.transaction(async (tx) => {
        for (let i = 0; i < orderedDocumentIds.length; i++) {
          await (tx as any).executeUpdate(
            'UPDATE variant_group_members SET member_order = ? WHERE variant_group_id = ? AND document_id = ?',
            [i, groupId, orderedDocumentIds[i]]
          );
        }
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async removeTag(documentId: DocumentId, tagId: TagId): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.executeUpdate(
        'DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?',
        [documentId, tagId]
      );
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async updatePreset(id: PresetId, input: any): Promise<Result<any, DataStoreError>> {
    try {
      const now = new Date().toISOString();
      await this.connection.executeUpdate(
        'UPDATE presets SET name = ?, updated_at = ? WHERE id = ?',
        [input.name, now, id]
      );
      const rows = await this.connection.execute('SELECT * FROM presets WHERE id = ?', [id]);
      return { ok: true, value: rows[0] };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async deletePreset(id: PresetId): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.executeUpdate('DELETE FROM presets WHERE id = ?', [id]);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async removePresetRule(presetId: PresetId, ruleId: string): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.executeUpdate('DELETE FROM preset_rules WHERE id = ?', [ruleId]);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async reorderPresetRules(presetId: PresetId, orderedRuleIds: string[]): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.transaction(async (tx) => {
        for (let i = 0; i < orderedRuleIds.length; i++) {
          await (tx as any).executeUpdate(
            'UPDATE preset_rules SET rule_order = ? WHERE id = ?',
            [i, orderedRuleIds[i]]
          );
        }
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async addPresetAdHocDocument(presetId: PresetId, documentId: DocumentId): Promise<Result<any, DataStoreError>> {
    try {
      // Get next inclusion order
      const countRows = await this.connection.execute(
        'SELECT COUNT(*) as cnt FROM preset_ad_hoc_documents WHERE preset_id = ?',
        [presetId]
      );
      const inclusion_order = countRows.length > 0 ? (countRows[0] as any).cnt : 0;

      const now = new Date().toISOString();
      await this.connection.executeUpdate(
        'INSERT INTO preset_ad_hoc_documents (preset_id, document_id, inclusion_order, created_at) VALUES (?, ?, ?, ?)',
        [presetId, documentId, inclusion_order, now]
      );

      return { ok: true, value: { presetId, documentId, inclusion_order } };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async removePresetAdHocDocument(presetId: PresetId, documentId: DocumentId): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.executeUpdate(
        'DELETE FROM preset_ad_hoc_documents WHERE preset_id = ? AND document_id = ?',
        [presetId, documentId]
      );
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async reorderPresetAdHocDocuments(presetId: PresetId, orderedDocumentIds: DocumentId[]): Promise<Result<void, DataStoreError>> {
    try {
      await this.connection.transaction(async (tx) => {
        for (let i = 0; i < orderedDocumentIds.length; i++) {
          await (tx as any).executeUpdate(
            'UPDATE preset_ad_hoc_documents SET inclusion_order = ? WHERE preset_id = ? AND document_id = ?',
            [i, presetId, orderedDocumentIds[i]]
          );
        }
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: DataStoreError.QueryFailed };
    }
  }

  async canAccess(documentId: DocumentId): Promise<boolean> {
    // MVP: No access control, always return true
    return true;
  }

  async writeOutput(filename: string, content: string): Promise<Result<void, Error>> {
    // Not implemented in MVP SQLite adapter
    return { ok: false, error: new Error('writeOutput not implemented in SQLite adapter') };
  }
}
