/**
 * SQL Template Package - Abstract SQL generation for all dialects
 */

export { SqlConnection, SqlRow } from './connection.js';
export type { ColumnDef, TableDef, SchemaDef } from './schema.js';
export { getSchemaDefinition, validateSchemaConsistency } from './schema.js';
export type { SchemaValidationResult } from './schema.js';
export { QueryBuilder } from './query-builder.js';
export type { QuerySpec } from './query-builder.js';
export { MigrationManager } from './migrations.js';
export type { Migration } from './migrations.js';
