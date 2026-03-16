// -----------------------------------------------------------------------------
// Operands 
// -----------------------------------------------------------------------------
export type Operand =
  | { type: 'tag'; tag: string }
  | { type: 'var'; var: string }
  | { type: 'literal'; value: string | number | boolean }
  | { type: 'literal_list'; values: (string | number)[] };

// -----------------------------------------------------------------------------
// Premises (Condition Trees)
// -----------------------------------------------------------------------------
export type Premise =
  // Comparisons
  | { op: 'eq'; left: Operand; right: Operand }
  | { op: 'neq'; left: Operand; right: Operand }
  | { op: 'lt'; left: Operand; right: Operand }
  | { op: 'lte'; left: Operand; right: Operand }
  | { op: 'gt'; left: Operand; right: Operand }
  | { op: 'gte'; left: Operand; right: Operand }
  | { op: 'in'; left: Operand; right: Operand }
  | { op: 'not_in'; left: Operand; right: Operand }
  
  // Logical combinators
  | { op: 'and'; conditions: Premise[] }
  | { op: 'or'; conditions: Premise[] }
  | { op: 'not'; condition: Premise }
  
  // Literals
  | { op: 'true' }
  | { op: 'always' };

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------
export interface SortKey {
  tag: string;
  value?: string | number;
  matchVar?: string;
}

export type Action =
  | { type: 'sort_by'; sortKeys: SortKey[] }
  | { type: 'toggle_on' }
  | { type: 'toggle_off' }
  | { type: 'select'; match: { tag: string; value: string | number } };

// -----------------------------------------------------------------------------
// Rule
// -----------------------------------------------------------------------------
export interface Rule {
  premise: Premise;
  action: Action;
}
