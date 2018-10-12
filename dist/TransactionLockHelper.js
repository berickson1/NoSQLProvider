"use strict";
/**
 * TransactionLockHelper.ts
 * Author: David de Regt
 * Copyright: Microsoft 2017
 *
 * Several of the different providers need various types of help enforcing exclusive/readonly transactions.  This helper keeps
 * store-specific lock info and releases transactions at the right time, when the underlying provider can't handle it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var _ = require("lodash");
var SyncTasks = require("synctasks");
var TransactionLockHelper = /** @class */ (function () {
    function TransactionLockHelper(_schema, _supportsDiscreteTransactions) {
        var _this = this;
        this._schema = _schema;
        this._supportsDiscreteTransactions = _supportsDiscreteTransactions;
        this._closed = false;
        this._exclusiveLocks = {};
        this._readOnlyCounts = {};
        this._pendingTransactions = [];
        _.each(this._schema.stores, function (store) {
            _this._exclusiveLocks[store.name] = false;
            _this._readOnlyCounts[store.name] = 0;
        });
    }
    TransactionLockHelper.prototype.closeWhenPossible = function () {
        if (!this._closingDefer) {
            this._closingDefer = SyncTasks.Defer();
            this._checkClose();
        }
        return this._closingDefer.promise();
    };
    TransactionLockHelper.prototype._checkClose = function () {
        if (!this._closed && this._closingDefer && !this.hasTransaction()) {
            this._closed = true;
            this._closingDefer.resolve(void 0);
        }
    };
    TransactionLockHelper.prototype.hasTransaction = function () {
        return this._pendingTransactions.length > 0 ||
            _.some(this._exclusiveLocks, function (value) { return value; }) ||
            _.some(this._readOnlyCounts, function (value) { return value > 0; });
    };
    TransactionLockHelper.prototype.openTransaction = function (storeNames, exclusive) {
        var _this = this;
        if (storeNames) {
            var missingStore = _.find(storeNames, function (name) { return !_.some(_this._schema.stores, function (store) { return name === store.name; }); });
            if (missingStore) {
                return SyncTasks.Rejected('Opened a transaction with a store name (' + missingStore + ') not defined in your schema!');
            }
        }
        var completionDefer = SyncTasks.Defer();
        var newToken = {
            // Undefined means lock all stores
            storeNames: storeNames || _.map(this._schema.stores, function (store) { return store.name; }),
            exclusive: exclusive,
            completionPromise: completionDefer.promise()
        };
        var pendingTrans = {
            token: newToken,
            opened: false,
            openDefer: SyncTasks.Defer(),
            completionDefer: completionDefer
        };
        this._pendingTransactions.push(pendingTrans);
        this._checkNextTransactions();
        return pendingTrans.openDefer.promise();
    };
    TransactionLockHelper.prototype.transactionComplete = function (token) {
        var pendingTransIndex = _.findIndex(this._pendingTransactions, function (trans) { return trans.token === token; });
        if (pendingTransIndex !== -1) {
            var pendingTrans = this._pendingTransactions[pendingTransIndex];
            if (pendingTrans.completionDefer) {
                pendingTrans.hadSuccess = true;
                var toResolve = pendingTrans.completionDefer;
                this._pendingTransactions.splice(pendingTransIndex, 1);
                pendingTrans.completionDefer = undefined;
                toResolve.resolve(void 0);
            }
            else {
                throw new Error('Completing a transaction that has already been completed. Stores: ' + token.storeNames.join(',') +
                    ', HadSuccess: ' + pendingTrans.hadSuccess);
            }
        }
        else {
            throw new Error('Completing a transaction that is no longer tracked. Stores: ' + token.storeNames.join(','));
        }
        this._cleanTransaction(token);
    };
    TransactionLockHelper.prototype.transactionFailed = function (token, message) {
        var pendingTransIndex = _.findIndex(this._pendingTransactions, function (trans) { return trans.token === token; });
        if (pendingTransIndex !== -1) {
            var pendingTrans = this._pendingTransactions[pendingTransIndex];
            if (pendingTrans.completionDefer) {
                pendingTrans.hadSuccess = false;
                var toResolve = pendingTrans.completionDefer;
                this._pendingTransactions.splice(pendingTransIndex, 1);
                pendingTrans.completionDefer = undefined;
                toResolve.reject(new Error(message));
            }
            else {
                throw new Error('Failing a transaction that has already been completed. Stores: ' + token.storeNames.join(',') +
                    ', HadSuccess: ' + pendingTrans.hadSuccess + ', Message: ' + message);
            }
        }
        else {
            throw new Error('Failing a transaction that is no longer tracked. Stores: ' + token.storeNames.join(',') + ', message: ' +
                message);
        }
        this._cleanTransaction(token);
    };
    TransactionLockHelper.prototype._cleanTransaction = function (token) {
        var _this = this;
        if (token.exclusive) {
            _.each(token.storeNames, function (storeName) {
                assert.ok(_this._exclusiveLocks[storeName], 'Missing expected exclusive lock for store: ' + storeName);
                _this._exclusiveLocks[storeName] = false;
            });
        }
        else {
            _.each(token.storeNames, function (storeName) {
                assert.ok(_this._readOnlyCounts[storeName] > 0, 'Missing expected readonly lock for store: ' + storeName);
                _this._readOnlyCounts[storeName]--;
            });
        }
        this._checkNextTransactions();
    };
    TransactionLockHelper.prototype._checkNextTransactions = function () {
        var _this = this;
        if (_.some(this._exclusiveLocks, function (lock) { return lock; }) && !this._supportsDiscreteTransactions) {
            // In these cases, no more transactions will be possible.  Break out early.
            return;
        }
        var _loop_1 = function (i) {
            var trans = this_1._pendingTransactions[i];
            if (trans.opened) {
                i++;
                return out_i_1 = i, "continue";
            }
            if (this_1._closingDefer) {
                this_1._pendingTransactions.splice(i, 1);
                trans.openDefer.reject('Closing Provider');
                return out_i_1 = i, "continue";
            }
            if (_.some(trans.token.storeNames, function (storeName) { return _this._exclusiveLocks[storeName] ||
                (trans.token.exclusive && _this._readOnlyCounts[storeName] > 0); })) {
                i++;
                return out_i_1 = i, "continue";
            }
            trans.opened = true;
            if (trans.token.exclusive) {
                _.each(trans.token.storeNames, function (storeName) {
                    _this._exclusiveLocks[storeName] = true;
                });
            }
            else {
                _.each(trans.token.storeNames, function (storeName) {
                    _this._readOnlyCounts[storeName]++;
                });
            }
            trans.openDefer.resolve(trans.token);
            out_i_1 = i;
        };
        var this_1 = this, out_i_1;
        for (var i = 0; i < this._pendingTransactions.length;) {
            _loop_1(i);
            i = out_i_1;
        }
        this._checkClose();
    };
    return TransactionLockHelper;
}());
exports.default = TransactionLockHelper;
//# sourceMappingURL=TransactionLockHelper.js.map