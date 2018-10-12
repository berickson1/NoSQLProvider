"use strict";
/**
 * NoSqlProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2016
 *
 * Low-level wrapper to expose a nosql-like database which can be backed by
 * numerous different backend store types, invisible to the consumer.  The
 * usage semantics are very similar to IndexedDB.  This file contains most
 * of the helper interfaces, while the specific database providers should
 * be required piecemeal.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var SyncTasks = require("synctasks");
var QuerySortOrder;
(function (QuerySortOrder) {
    QuerySortOrder[QuerySortOrder["None"] = 0] = "None";
    QuerySortOrder[QuerySortOrder["Forward"] = 1] = "Forward";
    QuerySortOrder[QuerySortOrder["Reverse"] = 2] = "Reverse";
})(QuerySortOrder = exports.QuerySortOrder || (exports.QuerySortOrder = {}));
var FullTextTermResolution;
(function (FullTextTermResolution) {
    FullTextTermResolution[FullTextTermResolution["And"] = 0] = "And";
    FullTextTermResolution[FullTextTermResolution["Or"] = 1] = "Or";
})(FullTextTermResolution = exports.FullTextTermResolution || (exports.FullTextTermResolution = {}));
// Abstract base type for a database provider.  Has accessors for opening transactions and one-off accesor helpers.
// Note: this is a different concept than a DbStore or DbIndex, although it provides a similar (or identical) interface.
var DbProvider = /** @class */ (function () {
    function DbProvider() {
    }
    DbProvider.prototype.open = function (dbName, schema, wipeIfExists, verbose) {
        // virtual call
        this._dbName = dbName;
        this._schema = schema;
        this._verbose = verbose;
        return undefined;
    };
    DbProvider.prototype.deleteDatabase = function () {
        var _this = this;
        return this.close().always(function () { return _this._deleteDatabaseInternal(); });
    };
    DbProvider.prototype.clearAllData = function () {
        var storeNames = this._schema.stores.map(function (store) { return store.name; });
        return this.openTransaction(storeNames, true).then(function (trans) {
            var clearers = storeNames.map(function (storeName) {
                var store = _.attempt(function () {
                    return trans.getStore(storeName);
                });
                if (!store || _.isError(store)) {
                    return SyncTasks.Rejected('Store "' + storeName + '" not found');
                }
                return store.clearAllData();
            });
            return SyncTasks.all(clearers).then(_.noop);
        });
    };
    DbProvider.prototype._getStoreTransaction = function (storeName, readWrite) {
        return this.openTransaction([storeName], readWrite).then(function (trans) {
            var store = _.attempt(function () {
                return trans.getStore(storeName);
            });
            if (!store || _.isError(store)) {
                return SyncTasks.Rejected('Store "' + storeName + '" not found');
            }
            return store;
        });
    };
    // Shortcut functions
    DbProvider.prototype.get = function (storeName, key) {
        return this._getStoreTransaction(storeName, false).then(function (store) {
            return store.get(key);
        });
    };
    DbProvider.prototype.getMultiple = function (storeName, keyOrKeys) {
        return this._getStoreTransaction(storeName, false).then(function (store) {
            return store.getMultiple(keyOrKeys);
        });
    };
    DbProvider.prototype.put = function (storeName, itemOrItems) {
        return this._getStoreTransaction(storeName, true).then(function (store) {
            return store.put(itemOrItems);
        });
    };
    DbProvider.prototype.remove = function (storeName, keyOrKeys) {
        return this._getStoreTransaction(storeName, true).then(function (store) {
            return store.remove(keyOrKeys);
        });
    };
    DbProvider.prototype._getStoreIndexTransaction = function (storeName, readWrite, indexName) {
        return this._getStoreTransaction(storeName, readWrite).then(function (store) {
            var index = _.attempt(function () {
                return indexName ? store.openIndex(indexName) : store.openPrimaryKey();
            });
            if (!index || _.isError(index)) {
                return SyncTasks.Rejected('Index "' + indexName + '" not found');
            }
            return index;
        });
    };
    DbProvider.prototype.getAll = function (storeName, indexName, reverseOrSortOrder, limit, offset) {
        return this._getStoreIndexTransaction(storeName, false, indexName).then(function (index) {
            return index.getAll(reverseOrSortOrder, limit, offset);
        });
    };
    DbProvider.prototype.getOnly = function (storeName, indexName, key, reverseOrSortOrder, limit, offset) {
        return this._getStoreIndexTransaction(storeName, false, indexName).then(function (index) {
            return index.getOnly(key, reverseOrSortOrder, limit, offset);
        });
    };
    DbProvider.prototype.getRange = function (storeName, indexName, keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive, reverseOrSortOrder, limit, offset) {
        return this._getStoreIndexTransaction(storeName, false, indexName).then(function (index) {
            return index.getRange(keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive, reverseOrSortOrder, limit, offset);
        });
    };
    DbProvider.prototype.countAll = function (storeName, indexName) {
        return this._getStoreIndexTransaction(storeName, false, indexName).then(function (index) {
            return index.countAll();
        });
    };
    DbProvider.prototype.countOnly = function (storeName, indexName, key) {
        return this._getStoreIndexTransaction(storeName, false, indexName).then(function (index) {
            return index.countOnly(key);
        });
    };
    DbProvider.prototype.countRange = function (storeName, indexName, keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive) {
        return this._getStoreIndexTransaction(storeName, false, indexName).then(function (index) {
            return index.countRange(keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive);
        });
    };
    DbProvider.prototype.fullTextSearch = function (storeName, indexName, searchPhrase, resolution, limit) {
        if (resolution === void 0) { resolution = FullTextTermResolution.And; }
        return this._getStoreIndexTransaction(storeName, false, indexName).then(function (index) {
            return index.fullTextSearch(searchPhrase, resolution);
        });
    };
    return DbProvider;
}());
exports.DbProvider = DbProvider;
// Runs down the given providers in order and tries to instantiate them.  If they're not supported, it will continue until it finds one
// that does work, or it will reject the promise if it runs out of providers and none work.
function openListOfProviders(providersToTry, dbName, schema, wipeIfExists, verbose) {
    if (wipeIfExists === void 0) { wipeIfExists = false; }
    if (verbose === void 0) { verbose = false; }
    var task = SyncTasks.Defer();
    var providerIndex = 0;
    var errorList = [];
    var tryNext = function () {
        if (providerIndex >= providersToTry.length) {
            task.reject(errorList.length <= 1 ? errorList[0] : errorList);
            return;
        }
        var provider = providersToTry[providerIndex];
        provider.open(dbName, schema, wipeIfExists, verbose).then(function () {
            task.resolve(provider);
        }, function (err) {
            errorList.push(err);
            providerIndex++;
            tryNext();
        });
    };
    tryNext();
    return task.promise();
}
exports.openListOfProviders = openListOfProviders;
//# sourceMappingURL=NoSqlProvider.js.map