import {
  DocumentId, SlotId, VariantGroupId, TagId, PresetId,
  Tag, CompositionSlot
} from './entities.js';
import { Premise, Action } from './rules.js';

// ─── Flat DB-level record types ──────────────────────────────────────────────

export interface DocumentRecord {
  id: DocumentId;
  projectId: string;
  title: string;
  alias: string | null;
  isComposition: boolean;
  content: string | null;       // null when isComposition is true
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantGroupRecord {
  id: VariantGroupId;
  projectId: string;
  name: string;
  createdAt: Date;
}

export interface VariantGroupMemberRecord {
  variantGroupId: VariantGroupId;
  documentId: DocumentId;
  memberOrder: number;          // 0-indexed; position 0 is the universal default
  createdAt: Date;
}

export interface TagRecord {
  id: TagId;
  projectId: string;
  key: string;
  value: string;
  color: string;                // hex string, e.g. '#6366f1'
  createdAt: Date;
}

export interface PresetRecord {
  id: PresetId;
  projectId: string;
  name: string;
  compositionId: DocumentId;
  createdAt: Date;
  updatedAt: Date;
}

export interface PresetRuleRecord {
  id: string;
  presetId: PresetId;
  ruleOrder: number;            // 0-indexed; lower = evaluated first
  premise: Premise;
  action: Action;
  description: string | null;
}

export interface PresetAdHocDocumentRecord {
  presetId: PresetId;
  documentId: DocumentId;
  inclusionOrder: number;       // 0-indexed; order appended after the composition tree
}

// ─── CRUD input types ────────────────────────────────────────────────────────

export interface CreateDocumentInput {
  projectId: string;
  title: string;
  alias?: string;
  isComposition: boolean;
  content?: string;             // required when isComposition is false; omit when true
}

export interface UpdateDocumentInput {
  title?: string;
  alias?: string | null;        // null explicitly clears the alias
  isComposition?: boolean;      // used only for convert operations (engine validates)
  content?: string | null;      // null clears content (used when converting to composition)
}

export interface DocumentFilters {
  isComposition?: boolean;
  titleContains?: string;       // case-insensitive substring match
  tagKey?: string;
  tagValue?: string;            // only used when tagKey is also provided
}

export interface CreateSlotInput {
  referenceType: 'document' | 'variant_group';
  referenceDocumentId?: DocumentId;       // required when referenceType === 'document'
  referenceVariantGroupId?: VariantGroupId; // required when referenceType === 'variant_group'
}
// Note: slotOrder is always appended at the end by the engine. Clients reorder via reorderSlots().

export interface CreateVariantGroupInput {
  projectId: string;
  name: string;
}

export interface CreatePresetInput {
  projectId: string;
  name: string;
  compositionId: DocumentId;
}

export interface UpdatePresetInput {
  name?: string;
  compositionId?: DocumentId;
}

export interface AddPresetRuleInput {
  premise: Premise;
  action: Action;
  description?: string;
}
// Note: rules are always appended at the end. Clients reorder via reorderRules().

// ─── Validation output types ─────────────────────────────────────────────────

export interface RuleValidationReport {
  presetId: string;
  issues: RuleValidationIssue[];
  isValid: boolean;             // true only when issues is empty
}

export interface RuleValidationIssue {
  ruleIndex: number;            // 0-indexed position in the rule list
  issueType: 'no_matching_slots' | 'unknown_variable_reference';
  description: string;
}

export interface BrokenReference {
  compositionId: DocumentId;
  slotId: SlotId;
  referenceType: 'document' | 'variant_group';
  referencedId: string;         // the ID of the missing document or variant group
}

// ─── Predicate pushdown types ────────────────────────────────────────────────

export type DocumentPredicate =
  | { type: 'tag_eq';      key: string; value: string }
  | { type: 'tag_neq';     key: string; value: string }
  | { type: 'tag_lt';      key: string; value: string }
  | { type: 'tag_lte';     key: string; value: string }
  | { type: 'tag_gt';      key: string; value: string }
  | { type: 'tag_gte';     key: string; value: string }
  | { type: 'tag_in';      key: string; values: string[] }
  | { type: 'tag_not_in';  key: string; values: string[] }
  | { type: 'tag_has_key'; key: string }
  | { type: 'is_composition'; value: boolean };

export interface QueryPlan {
  pushdownPredicates: DocumentPredicate[];
  localPredicates: Premise[];   // evaluated in-memory after the store returns results
}

// ─── Rule evaluator context (pre-fetched data passed to the pure evaluator) ──

export interface SlotRuleContext {
  slotId: SlotId;
  referenceType: 'document' | 'variant_group';
  // For document-reference slots: the referenced document's tags.
  // For variant_group slots: the default member's (memberOrder=0) tags.
  documentTags: Tag[];
  // Populated only when referenceType === 'variant_group'.
  // All members in ascending memberOrder, each with their tags.
  variantGroupMembers: VariantMemberContext[];
}

export interface VariantMemberContext {
  documentId: DocumentId;
  memberOrder: number;
  tags: Tag[];
}
