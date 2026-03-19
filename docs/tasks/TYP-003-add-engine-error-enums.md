# TYP-003 — Add Engine Error Enums

- **Sub-project:** `packages/types`
- **Branch:** `feat/TYP-003-error-enums`
- **Depends on:** none
- **Files modified:** `packages/types/src/results.ts`

## Objective

Add the per-entity error enums that the engine's CRUD methods return. These are separate from `DataStoreError` (which is a low-level storage error) and `ResolutionError` (which already exists).

## Behavior

Append the following enums to `packages/types/src/results.ts`. Do not modify existing content.

```typescript
export enum DocumentError {
  NotFound = 'NotFound',
  CompositionCannotHaveContent = 'CompositionCannotHaveContent',
  LeafRequiresContent = 'LeafRequiresContent',
  CannotConvertCompositionWithSlots = 'CannotConvertCompositionWithSlots',
  StorageFailure = 'StorageFailure',
}

export enum SlotError {
  NotFound = 'NotFound',
  CompositionNotFound = 'CompositionNotFound',
  TargetNotFound = 'TargetNotFound',
  WouldCreateCycle = 'WouldCreateCycle',
  InvalidOrdering = 'InvalidOrdering',
  StorageFailure = 'StorageFailure',
}

export enum VariantGroupError {
  NotFound = 'NotFound',
  MemberNotFound = 'MemberNotFound',
  CannotRemoveUniversalDefault = 'CannotRemoveUniversalDefault',
  DocumentAlreadyMember = 'DocumentAlreadyMember',
  StorageFailure = 'StorageFailure',
}

export enum TagError {
  NotFound = 'NotFound',
  DocumentNotFound = 'DocumentNotFound',
  DuplicateTagOnDocument = 'DuplicateTagOnDocument',
  StorageFailure = 'StorageFailure',
}

export enum PresetError {
  NotFound = 'NotFound',
  CompositionNotFound = 'CompositionNotFound',
  RuleNotFound = 'RuleNotFound',
  InvalidRuleOrdering = 'InvalidRuleOrdering',
  StorageFailure = 'StorageFailure',
}

export enum ValidationError {
  PresetNotFound = 'PresetNotFound',
  CompositionNotFound = 'CompositionNotFound',
  StorageFailure = 'StorageFailure',
}
```

Export all new enums from `packages/types/src/index.ts`.

## Test Cases

`tsc --noEmit` passes. All enums accessible from `@project/types`.

---
