"use strict";
/**
 * CordovaNativeSqliteProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * NoSqlProvider provider setup for cordova-native-sqlite, a cordova plugin backed by sqlite3.
 * Also works for react-native-sqlite-storage, since it's based on the same bindings, just make sure to pass in an instance
 * of the plugin into the constructor to be used, since window.sqlitePlugin won't exist.
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
var TransactionLockHelper_1 = require("./TransactionLockHelper");
var CordovaNativeSqliteProvider = /** @class */ (function (_super) {
    __extends(CordovaNativeSqliteProvider, _super);
    // You can use the openOptions object to pass extra optional parameters like androidDatabaseImplementation to the open command
    function CordovaNativeSqliteProvider(_plugin, _openOptions) {
        if (_plugin === void 0) { _plugin = window.sqlitePlugin; }
        if (_openOptions === void 0) { _openOptions = {}; }
        var _this = _super.call(this, true) || this;
        _this._plugin = _plugin;
        _this._openOptions = _openOptions;
        return _this;
    }
    CordovaNativeSqliteProvider.prototype.open = function (dbName, schema, wipeIfExists, verbose) {
        var _this = this;
        _super.prototype.open.call(this, dbName, schema, wipeIfExists, verbose);
        this._lockHelper = new TransactionLockHelper_1.default(schema, true);
        if (!this._plugin || !this._plugin.openDatabase) {
            return SyncTasks.Rejected('No support for native sqlite in this browser');
        }
        if (typeof (navigator) !== 'undefined' && navigator.userAgent && navigator.userAgent.indexOf('Mobile Crosswalk') !== -1) {
            return SyncTasks.Rejected('Android NativeSqlite is broken, skipping');
        }
        this._dbParams = _.extend({
            name: dbName + '.db',
            location: 2
        }, this._openOptions);
        var task = SyncTasks.Defer();
        this._db = this._plugin.openDatabase(this._dbParams, function () {
            task.resolve(void 0);
        }, function (err) {
            task.reject('Couldn\'t open database: ' + dbName + ', error: ' + JSON.stringify(err));
        });
        return task.promise().then(function () {
            return _this._ourVersionChecker(wipeIfExists);
        }).catch(function (err) {
            return SyncTasks.Rejected('Version check failure. Couldn\'t open database: ' + dbName +
                ', error: ' + JSON.stringify(err));
        });
    };
    CordovaNativeSqliteProvider.prototype.close = function () {
        var _this = this;
        if (!this._db) {
            return SyncTasks.Rejected('Database already closed');
        }
        return this._lockHelper.closeWhenPossible().then(function () {
            var def = SyncTasks.Defer();
            _this._db.close(function () {
                _this._db = undefined;
                def.resolve(void 0);
            }, function (err) {
                def.reject(err);
            });
            return def.promise();
        });
    };
    CordovaNativeSqliteProvider.prototype._deleteDatabaseInternal = function () {
        var _this = this;
        if (!this._plugin || !this._plugin.deleteDatabase) {
            return SyncTasks.Rejected('No support for deleting');
        }
        var task = SyncTasks.Defer();
        this._plugin.deleteDatabase(this._dbParams, function () {
            task.resolve(void 0);
        }, function (err) {
            task.reject('Couldn\'t delete the database ' + _this._dbName + ', error: ' + JSON.stringify(err));
        });
        return task.promise();
    };
    CordovaNativeSqliteProvider.prototype.openTransaction = function (storeNames, writeNeeded) {
        var _this = this;
        if (!this._db) {
            return SyncTasks.Rejected('Can\'t openTransation, Database closed');
        }
        if (this._closingDefer) {
            return SyncTasks.Rejected('Currently closing provider -- rejecting transaction open');
        }
        return this._lockHelper.openTransaction(storeNames, writeNeeded).then(function (transToken) {
            var deferred = SyncTasks.Defer();
            var ourTrans;
            (writeNeeded ? _this._db.transaction : _this._db.readTransaction).call(_this._db, function (trans) {
                ourTrans = new CordovaNativeSqliteTransaction(trans, _this._lockHelper, transToken, _this._schema, _this._verbose, 999, _this._supportsFTS3);
                deferred.resolve(ourTrans);
            }, function (err) {
                if (ourTrans) {
                    ourTrans.internal_markTransactionClosed();
                    _this._lockHelper.transactionFailed(transToken, 'CordovaNativeSqliteTransaction Error: ' + err.message);
                }
                else {
                    // We need to reject the transaction directly only in cases when it never finished creating.
                    deferred.reject(err);
                }
            }, function () {
                ourTrans.internal_markTransactionClosed();
                _this._lockHelper.transactionComplete(transToken);
            });
            return deferred.promise();
        });
    };
    return CordovaNativeSqliteProvider;
}(SqlProviderBase.SqlProviderBase));
exports.CordovaNativeSqliteProvider = CordovaNativeSqliteProvider;
var CordovaNativeSqliteTransaction = /** @class */ (function (_super) {
    __extends(CordovaNativeSqliteTransaction, _super);
    function CordovaNativeSqliteTransaction(trans, _lockHelper, _transToken, schema, verbose, maxVariables, supportsFTS3) {
        var _this = _super.call(this, trans, schema, verbose, maxVariables, supportsFTS3) || this;
        _this._lockHelper = _lockHelper;
        _this._transToken = _transToken;
        return _this;
    }
    CordovaNativeSqliteTransaction.prototype.getCompletionPromise = function () {
        return this._transToken.completionPromise;
    };
    CordovaNativeSqliteTransaction.prototype.abort = function () {
        // This will wrap through to the transaction error path above.
        this._trans.abort('Manually Aborted');
    };
    CordovaNativeSqliteTransaction.prototype.getErrorHandlerReturnValue = function () {
        // react-native-sqlite-storage throws on anything but false
        return false;
    };
    CordovaNativeSqliteTransaction.prototype._requiresUnicodeReplacement = function () {
        // TODO dadere (#333863): Possibly limit this to just iOS, since Android seems to handle it properly
        return true;
    };
    return CordovaNativeSqliteTransaction;
}(SqlProviderBase.SqliteSqlTransaction));
//# sourceMappingURL=CordovaNativeSqliteProvider.js.map