"use strict";
/**
 * NodeSqlite3DbProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * NoSqlProvider provider setup for NodeJs to use a sqlite3-based provider.
 * Can pass :memory: to the dbName for it to use an in-memory sqlite instance that's blown away each close() call.
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
var sqlite3 = require("sqlite3");
var SyncTasks = require("synctasks");
var SqlProviderBase = require("./SqlProviderBase");
var TransactionLockHelper_1 = require("./TransactionLockHelper");
var NodeSqlite3DbProvider = /** @class */ (function (_super) {
    __extends(NodeSqlite3DbProvider, _super);
    function NodeSqlite3DbProvider(supportsFTS3) {
        if (supportsFTS3 === void 0) { supportsFTS3 = true; }
        return _super.call(this, supportsFTS3) || this;
    }
    NodeSqlite3DbProvider.prototype.open = function (dbName, schema, wipeIfExists, verbose) {
        _super.prototype.open.call(this, dbName, schema, wipeIfExists, verbose);
        if (verbose) {
            sqlite3.verbose();
        }
        this._db = new sqlite3.Database(dbName);
        this._lockHelper = new TransactionLockHelper_1.default(schema, false);
        return this._ourVersionChecker(wipeIfExists);
    };
    NodeSqlite3DbProvider.prototype.openTransaction = function (storeNames, writeNeeded) {
        var _this = this;
        if (!this._db) {
            return SyncTasks.Rejected('Can\'t openTransaction on a closed database');
        }
        if (this._verbose) {
            console.log('openTransaction Called with Stores: ' + (storeNames ? storeNames.join(',') : undefined) +
                ', WriteNeeded: ' + writeNeeded);
        }
        return this._lockHelper.openTransaction(storeNames, writeNeeded).then(function (transToken) {
            if (_this._verbose) {
                console.log('openTransaction Resolved with Stores: ' + (storeNames ? storeNames.join(',') : undefined) +
                    ', WriteNeeded: ' + writeNeeded);
            }
            var trans = new NodeSqlite3Transaction(_this._db, _this._lockHelper, transToken, _this._schema, _this._verbose, _this._supportsFTS3);
            if (writeNeeded) {
                return trans.runQuery('BEGIN EXCLUSIVE TRANSACTION').then(function (ret) { return trans; });
            }
            return trans;
        });
    };
    NodeSqlite3DbProvider.prototype.close = function () {
        var _this = this;
        if (!this._db) {
            return SyncTasks.Rejected('Database already closed');
        }
        return this._lockHelper.closeWhenPossible().then(function () {
            var task = SyncTasks.Defer();
            _this._db.close(function (err) {
                _this._db = undefined;
                if (err) {
                    task.reject(err);
                }
                else {
                    task.resolve(void 0);
                }
            });
            return task.promise();
        });
    };
    NodeSqlite3DbProvider.prototype._deleteDatabaseInternal = function () {
        return SyncTasks.Rejected('No support for deleting');
    };
    return NodeSqlite3DbProvider;
}(SqlProviderBase.SqlProviderBase));
exports.default = NodeSqlite3DbProvider;
var NodeSqlite3Transaction = /** @class */ (function (_super) {
    __extends(NodeSqlite3Transaction, _super);
    function NodeSqlite3Transaction(_db, _lockHelper, _transToken, schema, verbose, supportsFTS3) {
        var _this = _super.call(this, schema, verbose, 999, supportsFTS3) || this;
        _this._db = _db;
        _this._lockHelper = _lockHelper;
        _this._transToken = _transToken;
        _this._openQueryCount = 0;
        _this._setTimer();
        return _this;
    }
    NodeSqlite3Transaction.prototype._clearTimer = function () {
        if (this._openTimer) {
            clearTimeout(this._openTimer);
            this._openTimer = undefined;
        }
    };
    NodeSqlite3Transaction.prototype._setTimer = function () {
        var _this = this;
        this._clearTimer();
        this._openTimer = setTimeout(function () {
            _this._openTimer = undefined;
            if (!_this._transToken.exclusive) {
                _this.internal_markTransactionClosed();
                _this._lockHelper.transactionComplete(_this._transToken);
                return;
            }
            _this.runQuery('COMMIT TRANSACTION').then(function () {
                _this._clearTimer();
                _this.internal_markTransactionClosed();
                _this._lockHelper.transactionComplete(_this._transToken);
            });
        }, 0);
    };
    NodeSqlite3Transaction.prototype.getCompletionPromise = function () {
        return this._transToken.completionPromise;
    };
    NodeSqlite3Transaction.prototype.abort = function () {
        var _this = this;
        this._clearTimer();
        if (!this._transToken.exclusive) {
            this.internal_markTransactionClosed();
            this._lockHelper.transactionFailed(this._transToken, 'NodeSqlite3Transaction Aborted');
            return;
        }
        this.runQuery('ROLLBACK TRANSACTION').always(function () {
            _this._clearTimer();
            _this.internal_markTransactionClosed();
            _this._lockHelper.transactionFailed(_this._transToken, 'NodeSqlite3Transaction Aborted');
        });
    };
    NodeSqlite3Transaction.prototype.runQuery = function (sql, parameters) {
        var _this = this;
        if (!this._isTransactionOpen()) {
            return SyncTasks.Rejected('SqliteSqlTransaction already closed');
        }
        this._clearTimer();
        this._openQueryCount++;
        var deferred = SyncTasks.Defer();
        if (this._verbose) {
            console.log('Query: ' + sql + (parameters ? ', Args: ' + JSON.stringify(parameters) : ''));
        }
        var stmt = this._db.prepare(sql);
        stmt.bind.apply(stmt, parameters);
        stmt.all(function (err, rows) {
            _this._openQueryCount--;
            if (_this._openQueryCount === 0) {
                _this._setTimer();
            }
            if (err) {
                console.error('Query Error: SQL: ' + sql + ', Error: ' + err.toString());
                deferred.reject(err);
            }
            else {
                deferred.resolve(rows);
            }
            stmt.finalize();
        });
        return deferred.promise();
    };
    return NodeSqlite3Transaction;
}(SqlProviderBase.SqlTransaction));
//# sourceMappingURL=NodeSqlite3DbProvider.js.map