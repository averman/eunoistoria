"use strict";
/**
 * SQL Template Package - Abstract SQL generation for all dialects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationManager = exports.QueryBuilder = exports.validateSchemaConsistency = exports.getSchemaDefinition = void 0;
var schema_js_1 = require("./schema.js");
Object.defineProperty(exports, "getSchemaDefinition", { enumerable: true, get: function () { return schema_js_1.getSchemaDefinition; } });
Object.defineProperty(exports, "validateSchemaConsistency", { enumerable: true, get: function () { return schema_js_1.validateSchemaConsistency; } });
var query_builder_js_1 = require("./query-builder.js");
Object.defineProperty(exports, "QueryBuilder", { enumerable: true, get: function () { return query_builder_js_1.QueryBuilder; } });
var migrations_js_1 = require("./migrations.js");
Object.defineProperty(exports, "MigrationManager", { enumerable: true, get: function () { return migrations_js_1.MigrationManager; } });
//# sourceMappingURL=index.js.map