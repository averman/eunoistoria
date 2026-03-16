// -----------------------------------------------------------------------------
// Branded Identifiers
// -----------------------------------------------------------------------------
export type DocumentId = string & { readonly __brand: unique symbol };
export type SlotId = string & { readonly __brand: unique symbol };
export type VariantGroupId = string & { readonly __brand: unique symbol };
export type PresetId = string & { readonly __brand: unique symbol };

// -----------------------------------------------------------------------------
// 1. Tags (Value Objects)
// -----------------------------------------------------------------------------
export interface Tag {
  key: string;
  value: string;
}

// =============================================================================
// ENGINE INPUT DTOs (Unresolved Graph from Database)
// =============================================================================

export type DataDocument = DataLeaf | DataComposition;

export interface BaseDataDocument {
  id: DocumentId;
  title: string;
  tags: Tag[];
}

// A DataLeaf has the actual text content.
export interface DataLeaf extends BaseDataDocument {
  type: 'leaf'; 
  content: string;
}

// A DataComposition has an array of UNRESOLVED Slot definitions.
// The engine reads these slots to figure out what to fetch next.
export interface DataComposition extends BaseDataDocument {
  type: 'composition';
  slots: CompositionSlot[];
}

export interface CompositionSlot {
  id: SlotId;

  // It points to exactly one specific document...
  documentId?: DocumentId;

  // ...OR a variant group, requiring an index to know which member to resolve.
  variantGroupId?: VariantGroupId;
  selectedIndex?: number;
}

export interface VariantGroup {
  id: VariantGroupId;
  members: DocumentId[];
}


// =============================================================================
// PRESETS & RULES
// =============================================================================
import { Rule } from './rules.js';

export interface Preset {
  id: PresetId;
  name: string;
  baseCompositionId: DocumentId;

  // The universal array index naturally dictates rule evaluation order.
  rules: Rule[];
}


// =============================================================================
// ENGINE OUTPUT (Resolved Graph for UI / OutputPorts)
// =============================================================================

export type ResolvedDocument = ResolvedLeaf | ResolvedComposition;

export interface BaseResolvedDocument {
  id: DocumentId;
  title: string;
  tags: Tag[];

  getContent(): string;
}

// A ResolvedLeaf holds its literal content.
export interface ResolvedLeaf extends BaseResolvedDocument {
  type: 'leaf';
  content: string;
}

// A ResolvedComposition holds an array of ALREADY EVALUATED nested documents.
// Slots and Variant Groups no longer exist here; the Engine has made the choices.
export interface ResolvedComposition extends BaseResolvedDocument {
  type: 'composition';
  children: ResolvedDocument[];
}
