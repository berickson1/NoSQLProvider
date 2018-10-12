"use strict";
/**
 * InMemoryProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * NoSqlProvider provider setup for a non-persisted in-memory database backing provider.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var SyncTasks = require("synctasks");
var FullTextSearchHelpers = require("./FullTextSearchHelpers");
var NoSqlProvider = require("./NoSqlProvider");
var NoSqlProviderUtils = require("./NoSqlProviderUtils");
var TransactionLockHelper_1 = require("./TransactionLockHelper");
// Very simple in-memory dbprovider for handling IE inprivate windows (and unit tests, maybe?)
var InMemoryProvider = /** @class */ (function (_super) {
    __extends(InMemoryProvider, _super);
    function InMemoryProvider() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._stores = {};
        return _this;
    }
    InMemoryProvider.prototype.open = function (dbName, schema, wipeIfExists, verbose) {
        var _this = this;
        _super.prototype.open.call(this, dbName, schema, wipeIfExists, verbose);
        _.each(this._schema.stores, function (storeSchema) {
            _this._stores[storeSchema.name] = { schema: storeSchema, data: {} };
        });
        this._lockHelper = new TransactionLockHelper_1.default(schema, true);
        return SyncTasks.Resolved();
    };
    InMemoryProvider.prototype._deleteDatabaseInternal = function () {
        return SyncTasks.Resolved();
    };
    InMemoryProvider.prototype.openTransaction = function (storeNames, writeNeeded) {
        var _this = this;
        return this._lockHelper.openTransaction(storeNames, writeNeeded).then(function (token) {
            return new InMemoryTransaction(_this, _this._lockHelper, token);
        });
    };
    InMemoryProvider.prototype.close = function () {
        var _this = this;
        return this._lockHelper.closeWhenPossible().then(function () {
            _this._stores = {};
        });
    };
    InMemoryProvider.prototype.internal_getStore = function (name) {
        return this._stores[name];
    };
    return InMemoryProvider;
}(NoSqlProvider.DbProvider));
exports.InMemoryProvider = InMemoryProvider;
// Notes: Doesn't limit the stores it can fetch to those in the stores it was "created" with, nor does it handle read-only transactions
var InMemoryTransaction = /** @class */ (function () {
    function InMemoryTransaction(_prov, _lockHelper, _transToken) {
        var _this = this;
        this._prov = _prov;
        this._lockHelper = _lockHelper;
        this._transToken = _transToken;
        this._stores = {};
        // Close the transaction on the next tick.  By definition, anything is completed synchronously here, so after an event tick
        // goes by, there can't have been anything pending.
        this._openTimer = setTimeout(function () {
            _this._openTimer = undefined;
            _this._commitTransaction();
            _this._lockHelper.transactionComplete(_this._transToken);
        }, 0);
    }
    InMemoryTransaction.prototype._commitTransaction = function () {
        _.each(this._stores, function (store) {
            store.internal_commitPendingData();
        });
    };
    InMemoryTransaction.prototype.getCompletionPromise = function () {
        return this._transToken.completionPromise;
    };
    InMemoryTransaction.prototype.abort = function () {
        _.each(this._stores, function (store) {
            store.internal_rollbackPendingData();
        });
        this._stores = {};
        if (this._openTimer) {
            clearTimeout(this._openTimer);
            this._openTimer = undefined;
        }
        this._lockHelper.transactionFailed(this._transToken, 'InMemoryTransaction Aborted');
    };
    InMemoryTransaction.prototype.markCompleted = function () {
        // noop
    };
    InMemoryTransaction.prototype.getStore = function (storeName) {
        if (!_.includes(NoSqlProviderUtils.arrayify(this._transToken.storeNames), storeName)) {
            throw new Error('Store not found in transaction-scoped store list: ' + storeName);
        }
        if (this._stores[storeName]) {
            return this._stores[storeName];
        }
        var store = this._prov.internal_getStore(storeName);
        if (!store) {
            throw new Error('Store not found: ' + storeName);
        }
        var ims = new InMemoryStore(this, store);
        this._stores[storeName] = ims;
        return ims;
    };
    InMemoryTransaction.prototype.internal_isOpen = function () {
        return !!this._openTimer;
    };
    return InMemoryTransaction;
}());
var InMemoryStore = /** @class */ (function () {
    function InMemoryStore(_trans, storeInfo) {
        this._trans = _trans;
        this._storeSchema = storeInfo.schema;
        this._committedStoreData = storeInfo.data;
        this._mergedData = this._committedStoreData;
    }
    InMemoryStore.prototype._checkDataClone = function () {
        if (!this._pendingCommitDataChanges) {
            this._pendingCommitDataChanges = {};
            this._mergedData = _.assign({}, this._committedStoreData);
        }
    };
    InMemoryStore.prototype.internal_commitPendingData = function () {
        var _this = this;
        _.each(this._pendingCommitDataChanges, function (val, key) {
            if (val === undefined) {
                delete _this._committedStoreData[key];
            }
            else {
                _this._committedStoreData[key] = val;
            }
        });
        this._pendingCommitDataChanges = undefined;
        this._mergedData = this._committedStoreData;
    };
    InMemoryStore.prototype.internal_rollbackPendingData = function () {
        this._pendingCommitDataChanges = undefined;
        this._mergedData = this._committedStoreData;
    };
    InMemoryStore.prototype.get = function (key) {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        var joinedKey = _.attempt(function () {
            return NoSqlProviderUtils.serializeKeyToString(key, _this._storeSchema.primaryKeyPath);
        });
        if (_.isError(joinedKey)) {
            return SyncTasks.Rejected(joinedKey);
        }
        return SyncTasks.Resolved(this._mergedData[joinedKey]);
    };
    InMemoryStore.prototype.getMultiple = function (keyOrKeys) {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        var joinedKeys = _.attempt(function () {
            return NoSqlProviderUtils.formListOfSerializedKeys(keyOrKeys, _this._storeSchema.primaryKeyPath);
        });
        if (_.isError(joinedKeys)) {
            return SyncTasks.Rejected(joinedKeys);
        }
        return SyncTasks.Resolved(_.compact(_.map(joinedKeys, function (key) { return _this._mergedData[key]; })));
    };
    InMemoryStore.prototype.put = function (itemOrItems) {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        this._checkDataClone();
        var err = _.attempt(function () {
            _.each(NoSqlProviderUtils.arrayify(itemOrItems), function (item) {
                var pk = NoSqlProviderUtils.getSerializedKeyForKeypath(item, _this._storeSchema.primaryKeyPath);
                _this._pendingCommitDataChanges[pk] = item;
                _this._mergedData[pk] = item;
            });
        });
        if (err) {
            return SyncTasks.Rejected(err);
        }
        return SyncTasks.Resolved();
    };
    InMemoryStore.prototype.remove = function (keyOrKeys) {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        this._checkDataClone();
        var joinedKeys = _.attempt(function () {
            return NoSqlProviderUtils.formListOfSerializedKeys(keyOrKeys, _this._storeSchema.primaryKeyPath);
        });
        if (_.isError(joinedKeys)) {
            return SyncTasks.Rejected(joinedKeys);
        }
        _.each(joinedKeys, function (key) {
            _this._pendingCommitDataChanges[key] = undefined;
            delete _this._mergedData[key];
        });
        return SyncTasks.Resolved();
    };
    InMemoryStore.prototype.openPrimaryKey = function () {
        this._checkDataClone();
        return new InMemoryIndex(this._trans, this._mergedData, undefined, this._storeSchema.primaryKeyPath);
    };
    InMemoryStore.prototype.openIndex = function (indexName) {
        var indexSchema = _.find(this._storeSchema.indexes, function (idx) { return idx.name === indexName; });
        if (!indexSchema) {
            throw new Error('Index not found: ' + indexName);
        }
        this._checkDataClone();
        return new InMemoryIndex(this._trans, this._mergedData, indexSchema, this._storeSchema.primaryKeyPath);
    };
    InMemoryStore.prototype.clearAllData = function () {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        this._checkDataClone();
        _.each(this._mergedData, function (val, key) {
            _this._pendingCommitDataChanges[key] = undefined;
        });
        this._mergedData = {};
        return SyncTasks.Resolved();
    };
    return InMemoryStore;
}());
// Note: Currently maintains nothing interesting -- rebuilds the results every time from scratch.  Scales like crap.
var InMemoryIndex = /** @class */ (function (_super) {
    __extends(InMemoryIndex, _super);
    function InMemoryIndex(_trans, _mergedData, indexSchema, primaryKeyPath) {
        var _this = _super.call(this, indexSchema, primaryKeyPath) || this;
        _this._trans = _trans;
        _this._mergedData = _mergedData;
        return _this;
    }
    // Warning: This function can throw, make sure to trap.
    InMemoryIndex.prototype._calcChunkedData = function () {
        var _this = this;
        if (!this._indexSchema) {
            // Primary key -- use data intact
            return this._mergedData;
        }
        // If it's not the PK index, re-pivot the data to be keyed off the key value built from the keypath
        var data = {};
        _.each(this._mergedData, function (item) {
            // Each item may be non-unique so store as an array of items for each key
            var keys;
            if (_this._indexSchema.fullText) {
                keys = _.map(FullTextSearchHelpers.getFullTextIndexWordsForItem(_this._keyPath, item), function (val) {
                    return NoSqlProviderUtils.serializeKeyToString(val, _this._keyPath);
                });
            }
            else if (_this._indexSchema.multiEntry) {
                // Have to extract the multiple entries into this alternate table...
                var valsRaw = NoSqlProviderUtils.getValueForSingleKeypath(item, _this._keyPath);
                if (valsRaw) {
                    keys = _.map(NoSqlProviderUtils.arrayify(valsRaw), function (val) {
                        return NoSqlProviderUtils.serializeKeyToString(val, _this._keyPath);
                    });
                }
            }
            else {
                keys = [NoSqlProviderUtils.getSerializedKeyForKeypath(item, _this._keyPath)];
            }
            _.each(keys, function (key) {
                if (!data[key]) {
                    data[key] = [item];
                }
                else {
                    data[key].push(item);
                }
            });
        });
        return data;
    };
    InMemoryIndex.prototype.getAll = function (reverseOrSortOrder, limit, offset) {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        var data = _.attempt(function () {
            return _this._calcChunkedData();
        });
        if (_.isError(data)) {
            return SyncTasks.Rejected(data);
        }
        var sortedKeys = _.keys(data).sort();
        return this._returnResultsFromKeys(data, sortedKeys, reverseOrSortOrder, limit, offset);
    };
    InMemoryIndex.prototype.getOnly = function (key, reverseOrSortOrder, limit, offset) {
        return this.getRange(key, key, false, false, reverseOrSortOrder, limit, offset);
    };
    InMemoryIndex.prototype.getRange = function (keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive, reverseOrSortOrder, limit, offset) {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        var data;
        var sortedKeys;
        var err = _.attempt(function () {
            data = _this._calcChunkedData();
            sortedKeys = _this._getKeysForRange(data, keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive).sort();
        });
        if (err) {
            return SyncTasks.Rejected(err);
        }
        return this._returnResultsFromKeys(data, sortedKeys, reverseOrSortOrder, limit, offset);
    };
    // Warning: This function can throw, make sure to trap.
    InMemoryIndex.prototype._getKeysForRange = function (data, keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive) {
        var keyLow = NoSqlProviderUtils.serializeKeyToString(keyLowRange, this._keyPath);
        var keyHigh = NoSqlProviderUtils.serializeKeyToString(keyHighRange, this._keyPath);
        return _.filter(_.keys(data), function (key) {
            return (key > keyLow || (key === keyLow && !lowRangeExclusive)) && (key < keyHigh || (key === keyHigh && !highRangeExclusive));
        });
    };
    InMemoryIndex.prototype._returnResultsFromKeys = function (data, sortedKeys, reverseOrSortOrder, limit, offset) {
        if (reverseOrSortOrder === true || reverseOrSortOrder === NoSqlProvider.QuerySortOrder.Reverse) {
            sortedKeys = _.reverse(sortedKeys);
        }
        if (offset) {
            sortedKeys = sortedKeys.slice(offset);
        }
        if (limit) {
            sortedKeys = sortedKeys.slice(0, limit);
        }
        var results = _.map(sortedKeys, function (key) { return data[key]; });
        return SyncTasks.Resolved(_.flatten(results));
    };
    InMemoryIndex.prototype.countAll = function () {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        var data = _.attempt(function () {
            return _this._calcChunkedData();
        });
        if (_.isError(data)) {
            return SyncTasks.Rejected(data);
        }
        return SyncTasks.Resolved(_.keys(data).length);
    };
    InMemoryIndex.prototype.countOnly = function (key) {
        return this.countRange(key, key, false, false);
    };
    InMemoryIndex.prototype.countRange = function (keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive) {
        var _this = this;
        if (!this._trans.internal_isOpen()) {
            return SyncTasks.Rejected('InMemoryTransaction already closed');
        }
        var keys = _.attempt(function () {
            var data = _this._calcChunkedData();
            return _this._getKeysForRange(data, keyLowRange, keyHighRange, lowRangeExclusive, highRangeExclusive);
        });
        if (_.isError(keys)) {
            return SyncTasks.Rejected(keys);
        }
        return SyncTasks.Resolved(keys.length);
    };
    return InMemoryIndex;
}(FullTextSearchHelpers.DbIndexFTSFromRangeQueries));
//# sourceMappingURL=InMemoryProvider.js.map