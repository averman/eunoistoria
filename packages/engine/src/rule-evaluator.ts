import {
  Rule, Premise, Operand, Action, SortKey,
  Tag, SelectionMap, VariableMap, SlotRuleContext, DocumentId,
} from '@eunoistoria/types';

function coerce(v: unknown): number | string | boolean | unknown {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? v : n;
  }
  return v;
}

function resolveOperand(operand: Operand, tags: Tag[], variables: VariableMap): unknown {
  switch (operand.type) {
    case 'tag': {
      const tag = tags.find(t => t.key === operand.tag);
      return tag ? tag.value : undefined;
    }
    case 'var':
      return variables.get(operand.var);
    case 'literal':
      return operand.value;
    case 'literal_list':
      return operand.values;
  }
}

function hasTagOperand(premise: Premise): boolean {
  switch (premise.op) {
    case 'and': return premise.conditions.some(hasTagOperand);
    case 'or':  return premise.conditions.some(hasTagOperand);
    case 'not': return hasTagOperand(premise.condition);
    case 'true':
    case 'always': return false;
    default: {
      const p = premise as { left?: Operand; right?: Operand };
      if (p.left?.type === 'tag' || p.right?.type === 'tag') return true;
      return false;
    }
  }
}

function isPremiseVariableOnly(premise: Premise): boolean {
  return !hasTagOperand(premise);
}

function evaluatePremise(premise: Premise, tags: Tag[], variables: VariableMap): boolean {
  switch (premise.op) {
    case 'true':
    case 'always':
      return true;

    case 'and':
      return premise.conditions.every(c => evaluatePremise(c, tags, variables));

    case 'or':
      return premise.conditions.some(c => evaluatePremise(c, tags, variables));

    case 'not':
      return !evaluatePremise(premise.condition, tags, variables);

    default: {
      const p = premise as Extract<Premise, { left: Operand; right: Operand }>;
      const leftRaw = resolveOperand(p.left, tags, variables);
      const rightRaw = resolveOperand(p.right, tags, variables);

      if (premise.op === 'in') {
        if (leftRaw === undefined || rightRaw === undefined) return false;
        const left = coerce(leftRaw as string);
        const rightList = rightRaw as Array<string | number>;
        return rightList.some(rv => {
          const r = coerce(rv);
          return typeof left === 'number' && typeof r === 'number' ? left === r : String(left) === String(r);
        });
      }

      if (premise.op === 'not_in') {
        if (leftRaw === undefined || rightRaw === undefined) return false;
        const left = coerce(leftRaw as string);
        const rightList = rightRaw as Array<string | number>;
        return !rightList.some(rv => {
          const r = coerce(rv);
          return typeof left === 'number' && typeof r === 'number' ? left === r : String(left) === String(r);
        });
      }

      if (leftRaw === undefined || rightRaw === undefined) return false;
      const left = coerce(leftRaw as string);
      const right = coerce(rightRaw as string);
      const bothNumeric = typeof left === 'number' && typeof right === 'number';

      switch (premise.op) {
        case 'eq':  return bothNumeric ? left === right : String(left) === String(right);
        case 'neq': return bothNumeric ? left !== right : String(left) !== String(right);
        case 'lt':  return bothNumeric ? left < right : String(left) < String(right);
        case 'lte': return bothNumeric ? left <= right : String(left) <= String(right);
        case 'gt':  return bothNumeric ? left > right : String(left) > String(right);
        case 'gte': return bothNumeric ? left >= right : String(left) >= String(right);
      }
      return false;
    }
  }
}

function sortMembersByKeys(
  members: Array<{ documentId: DocumentId; memberOrder: number; tags: Tag[] }>,
  sortKeys: SortKey[],
  variables: VariableMap
): DocumentId[] {
  const prioritized = members.map(member => {
    let priority = sortKeys.length; // lowest priority = no match
    for (let i = 0; i < sortKeys.length; i++) {
      const sk = sortKeys[i];
      const tag = member.tags.find(t => t.key === sk.tag);
      if (!tag) continue;
      const tagVal = coerce(tag.value);
      if (sk.value !== undefined) {
        const skVal = coerce(String(sk.value));
        if (typeof tagVal === 'number' && typeof skVal === 'number' ? tagVal === skVal : String(tagVal) === String(skVal)) {
          priority = i;
          break;
        }
      } else if (sk.matchVar !== undefined) {
        const varVal = variables.get(sk.matchVar);
        if (varVal !== undefined) {
          const skVal = coerce(String(varVal));
          if (typeof tagVal === 'number' && typeof skVal === 'number' ? tagVal === skVal : String(tagVal) === String(skVal)) {
            priority = i;
            break;
          }
        }
      }
    }
    return { documentId: member.documentId, priority, memberOrder: member.memberOrder };
  });

  // Stable sort by priority (lower = higher priority)
  prioritized.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.memberOrder - b.memberOrder; // stable: preserve original relative order
  });

  return prioritized.map(p => p.documentId);
}

export function evaluateRules(
  rules: Rule[],
  variables: VariableMap,
  slotContexts: SlotRuleContext[]
): SelectionMap {
  const toggleStates = new Map<string, boolean>();
  const sortOrders = new Map<string, DocumentId[]>();

  // Initialize toggleStates (all true) and sortOrders (by original memberOrder)
  for (const slot of slotContexts) {
    toggleStates.set(slot.slotId, true);
    if (slot.referenceType === 'variant_group') {
      const sorted = [...slot.variantGroupMembers]
        .sort((a, b) => a.memberOrder - b.memberOrder)
        .map(m => m.documentId);
      sortOrders.set(slot.slotId, sorted);
    }
  }

  for (const rule of rules) {
    const { premise, action } = rule;
    const isVarOnly = isPremiseVariableOnly(premise);

    if (action.type === 'toggle_on' || action.type === 'toggle_off') {
      const toggleValue = action.type === 'toggle_on';
      if (isVarOnly) {
        const fires = evaluatePremise(premise, [], variables);
        if (fires) {
          for (const slot of slotContexts) {
            toggleStates.set(slot.slotId, toggleValue);
          }
        }
      } else {
        for (const slot of slotContexts) {
          const fires = evaluatePremise(premise, slot.documentTags, variables);
          if (fires) {
            toggleStates.set(slot.slotId, toggleValue);
          }
        }
      }
    } else if (action.type === 'sort_by') {
      const sortKeys = action.sortKeys;
      for (const slot of slotContexts) {
        if (slot.referenceType !== 'variant_group') continue;
        if (isVarOnly) {
          const fires = evaluatePremise(premise, [], variables);
          if (!fires) continue;
        }
        // For tag-based premises in sort_by, the premise fires if slot.documentTags (default member) matches
        // Actually, for sort_by with tag premises, we evaluate premise per member to determine sort priority
        // The premise here determines if the rule FIRES for this slot at all
        // When premise references tags: evaluate against slot.documentTags (default member tags)
        if (!isVarOnly) {
          const fires = evaluatePremise(premise, slot.documentTags, variables);
          if (!fires) continue;
        }
        const sorted = sortMembersByKeys(slot.variantGroupMembers, sortKeys, variables);
        sortOrders.set(slot.slotId, sorted);
      }
    } else if (action.type === 'select') {
      // Treat as sort_by with a single sort key
      const sortKeys: SortKey[] = [{ tag: action.match.tag, value: action.match.value }];
      for (const slot of slotContexts) {
        if (slot.referenceType !== 'variant_group') continue;
        if (isVarOnly) {
          const fires = evaluatePremise(premise, [], variables);
          if (!fires) continue;
        } else {
          const fires = evaluatePremise(premise, slot.documentTags, variables);
          if (!fires) continue;
        }
        const sorted = sortMembersByKeys(slot.variantGroupMembers, sortKeys, variables);
        sortOrders.set(slot.slotId, sorted);
      }
    }
  }

  return { toggleStates, sortOrders };
}
