"use strict";
/**
 * WebSqlProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * NoSqlProvider provider setup for WebSql, a browser storage backing.
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
var SqlProviderBase = require("./SqlProviderBase");
// The DbProvider implementation for WebSQL.  This provider does a bunch of awkward stuff to pretend that a relational SQL store
// is actually a NoSQL store.  We store the raw object as a JSON.encoded string in the nsp_data column, and have an nsp_pk column
// for the primary keypath value, then nsp_i_[index name] columns for each of the indexes.
var WebSqlProvider = /** @class */ (function (_super) {
    __extends(WebSqlProvider, _super);
    function WebSqlProvider(supportsFTS3) {
        if (supportsFTS3 === void 0) { supportsFTS3 = true; }
        return _super.call(this, supportsFTS3) || this;
    }
    WebSqlProvider.prototype.open = function (dbName, schema, wipeIfExists, verbose) {
        var _this = this;
        _super.prototype.open.call(this, dbName, schema, wipeIfExists, verbose);
        if (!window.openDatabase) {
            return SyncTasks.Rejected('No support for WebSQL in this browser');
        }
        try {
            this._db = window.openDatabase(dbName, '', dbName, 10 * 1024 * 1024);
        }
        catch (e) {
            if (e.code === 18) {
                // User rejected the quota attempt
                return SyncTasks.Rejected('User rejected quota allowance');
            }
            return SyncTasks.Rejected('Unknown Exception opening WebSQL database: ' + e.toString());
        }
        if (!this._db) {
            return SyncTasks.Rejected('Couldn\'t open database: ' + dbName);
        }
        var upgradeDbDeferred = SyncTasks.Defer();
        var changeVersionDeferred;
        var oldVersion = Number(this._db.version);
        if (oldVersion !== this._schema.version) {
            // Needs a schema upgrade/change
            if (!wipeIfExists && this._schema.version < oldVersion) {
                console.log('Database version too new (' + oldVersion + ') for schema version (' + this._schema.version + '). Wiping!');
                // Note: the reported DB version won't change back to the older number until after you do a put command onto the DB.
                wipeIfExists = true;
            }
            changeVersionDeferred = SyncTasks.Defer();
            var errorDetail_1;
            this._db.changeVersion(this._db.version, this._schema.version.toString(), function (t) {
                var trans = new WebSqlTransaction(t, SyncTasks.Defer().promise(), _this._schema, _this._verbose, 999, _this._supportsFTS3);
                _this._upgradeDb(trans, oldVersion, wipeIfExists).then(function () {
                    upgradeDbDeferred.resolve(void 0);
                }, function (err) {
                    errorDetail_1 = err && err.message ? err.message : err.toString();
                    // Got a promise error.  Force the transaction to abort.
                    trans.abort();
                });
            }, function (err) {
                upgradeDbDeferred.reject(err.message + (errorDetail_1 ? ', Detail: ' + errorDetail_1 : ''));
            }, function () {
                changeVersionDeferred.resolve(void 0);
            });
        }
        else if (wipeIfExists) {
            // No version change, but wipe anyway
            var errorDetail_2;
            this.openTransaction([], true).then(function (trans) {
                _this._upgradeDb(trans, oldVersion, true).then(function () {
                    upgradeDbDeferred.resolve(void 0);
                }, function (err) {
                    errorDetail_2 = err && err.message ? err.message : err.toString();
                    // Got a promise error.  Force the transaction to abort.
                    trans.abort();
                });
            }, function (err) {
                upgradeDbDeferred.reject(err.message + (errorDetail_2 ? ', Detail: ' + errorDetail_2 : ''));
            });
        }
        else {
            upgradeDbDeferred.resolve(void 0);
        }
        return upgradeDbDeferred.promise().then(function () { return changeVersionDeferred ? changeVersionDeferred.promise() : undefined; });
    };
    WebSqlProvider.prototype.close = function () {
        this._db = undefined;
        return SyncTasks.Resolved();
    };
    WebSqlProvider.prototype._deleteDatabaseInternal = function () {
        return SyncTasks.Rejected('No support for deleting');
    };
    WebSqlProvider.prototype.openTransaction = function (storeNames, writeNeeded) {
        var _this = this;
        if (!this._db) {
            return SyncTasks.Rejected('Database closed');
        }
        var deferred = SyncTasks.Defer();
        var ourTrans;
        var finishDefer = SyncTasks.Defer();
        (writeNeeded ? this._db.transaction : this._db.readTransaction).call(this._db, function (trans) {
            ourTrans = new WebSqlTransaction(trans, finishDefer.promise(), _this._schema, _this._verbose, 999, _this._supportsFTS3);
            deferred.resolve(ourTrans);
        }, function (err) {
            if (ourTrans) {
                // Got an error from inside the transaction.  Error out all pending queries on the 
                // transaction since they won't exit out gracefully for whatever reason.
                ourTrans.failAllPendingQueries(err);
                ourTrans.internal_markTransactionClosed();
                if (finishDefer) {
                    finishDefer.reject('WebSqlTransaction Error: ' + err.message);
                    finishDefer = undefined;
                }
            }
            else {
                deferred.reject(err);
            }
        }, function () {
            ourTrans.internal_markTransactionClosed();
            if (finishDefer) {
                finishDefer.resolve(void 0);
                finishDefer = undefined;
            }
        });
        return deferred.promise();
    };
    return WebSqlProvider;
}(SqlProviderBase.SqlProviderBase));
exports.WebSqlProvider = WebSqlProvider;
var WebSqlTransaction = /** @class */ (function (_super) {
    __extends(WebSqlTransaction, _super);
    function WebSqlTransaction(trans, _completionPromise, schema, verbose, maxVariables, supportsFTS3) {
        var _this = _super.call(this, trans, schema, verbose, maxVariables, supportsFTS3) || this;
        _this.trans = trans;
        _this._completionPromise = _completionPromise;
        return _this;
    }
    WebSqlTransaction.prototype.getCompletionPromise = function () {
        return this._completionPromise;
    };
    WebSqlTransaction.prototype.abort = function () {
        // The only way to rollback a websql transaction is by forcing an error (which rolls back the trans):
        // http://stackoverflow.com/questions/16225320/websql-dont-rollback
        this.runQuery('ERROR ME TO DEATH').always(_.noop);
    };
    WebSqlTransaction.prototype.getErrorHandlerReturnValue = function () {
        // Causes a rollback on websql
        return true;
    };
    return WebSqlTransaction;
}(SqlProviderBase.SqliteSqlTransaction));
//# sourceMappingURL=WebSqlProvider.js.map