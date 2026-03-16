import { SlotId, DocumentId } from './entities.js';

// Output of Rule Evaluation Phase (Phase 1)
export interface SelectionMap {
  // slotId -> boolean (default true)
  toggleStates: Map<SlotId, boolean>; 
  
  // slotId (VariantGroup slots only) -> Ordered array of accessible DocumentIds
  sortOrders: Map<SlotId, DocumentId[]>; 
}

// Variables supplied by the presentation layer
export type VariableMap = Map<string, string | number | boolean | string[]>;
