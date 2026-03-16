export type Result<T, E> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

export enum DataStoreError {
  ConnectionFailed = 'ConnectionFailed',
  QueryFailed = 'QueryFailed',
  TransactionFailed = 'TransactionFailed',
  ConstraintViolation = 'ConstraintViolation',
  NotFound = 'NotFound'
}

export enum ResolutionError {
  PresetNotFound = 'PresetNotFound',
  MaxDepthExceeded = 'MaxDepthExceeded',
  BrokenReference = 'BrokenReference'
}
