"use strict";
/**
 * SQLite Adapter for Eunoistoria Engine
 * Provides a concrete implementation of the DataStorePort using SQLite via better-sqlite3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteDataStore = exports.SqliteConnection = void 0;
var connection_js_1 = require("./connection.js");
Object.defineProperty(exports, "SqliteConnection", { enumerable: true, get: function () { return connection_js_1.SqliteConnection; } });
var data_store_js_1 = require("./data-store.js");
Object.defineProperty(exports, "SqliteDataStore", { enumerable: true, get: function () { return data_store_js_1.SqliteDataStore; } });
//# sourceMappingURL=index.js.map