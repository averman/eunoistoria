import {
  Premise, VariableMap, DocumentPredicate, QueryPlan,
} from '@eunoistoria/types';

/**
 * ENG-007: Query Builder
 * Analyzes a Premise and splits it into pushdown predicates (for the data store)
 * and local predicates (for in-memory evaluation).
 */
export function buildQueryPlan(premise: Premise, variables: VariableMap): QueryPlan {
  // Compound premises are never pushed down
  if (premise.op === 'and' || premise.op === 'or' || premise.op === 'not') {
    return { pushdownPredicates: [], localPredicates: [premise] };
  }

  // Always/true → no predicates at all
  if (premise.op === 'true' || premise.op === 'always') {
    return { pushdownPredicates: [], localPredicates: [] };
  }

  // Leaf comparison — check pushdown eligibility
  const p = premise as Extract<Premise, { left: unknown; right: unknown }>;
  const left = (p as any).left;
  const right = (p as any).right;

  // Left must be a tag operand
  if (!left || left.type !== 'tag') {
    return { pushdownPredicates: [], localPredicates: [premise] };
  }

  // Right must be literal, literal_list, or a resolved var
  let resolvedRight: string | string[] | undefined;
  if (right.type === 'literal') {
    resolvedRight = String(right.value);
  } else if (right.type === 'literal_list') {
    resolvedRight = right.values.map(String) as string[];
  } else if (right.type === 'var') {
    const varVal = variables.get(right.var);
    if (varVal === undefined) {
      // Variable not present → local
      return { pushdownPredicates: [], localPredicates: [premise] };
    }
    resolvedRight = String(varVal);
  } else {
    return { pushdownPredicates: [], localPredicates: [premise] };
  }

  const key = left.tag as string;

  let predicate: DocumentPredicate;
  switch (premise.op) {
    case 'eq':  predicate = { type: 'tag_eq',  key, value: resolvedRight as string }; break;
    case 'neq': predicate = { type: 'tag_neq', key, value: resolvedRight as string }; break;
    case 'lt':  predicate = { type: 'tag_lt',  key, value: resolvedRight as string }; break;
    case 'lte': predicate = { type: 'tag_lte', key, value: resolvedRight as string }; break;
    case 'gt':  predicate = { type: 'tag_gt',  key, value: resolvedRight as string }; break;
    case 'gte': predicate = { type: 'tag_gte', key, value: resolvedRight as string }; break;
    case 'in':
      predicate = { type: 'tag_in', key, values: resolvedRight as string[] }; break;
    case 'not_in':
      predicate = { type: 'tag_not_in', key, values: resolvedRight as string[] }; break;
    default:
      return { pushdownPredicates: [], localPredicates: [premise] };
  }

  return { pushdownPredicates: [predicate], localPredicates: [] };
}
