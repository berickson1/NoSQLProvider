/**
 * CordovaNativeSqliteProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * NoSqlProvider provider setup for cordova-native-sqlite, a cordova plugin backed by sqlite3.
 * Also works for react-native-sqlite-storage, since it's based on the same bindings, just make sure to pass in an instance
 * of the plugin into the constructor to be used, since window.sqlitePlugin won't exist.
 */
import SyncTasks = require('synctasks');
import NoSqlProvider = require('./NoSqlProvider');
import SqlProviderBase = require('./SqlProviderBase');
declare global {
    interface Window {
        sqlitePlugin: any;
    }
}
export declare type SqliteSuccessCallback = () => void;
export declare type SqliteErrorCallback = (e: Error) => void;
export interface SqlitePluginDbOptionalParams {
    createFromLocation?: number;
    androidDatabaseImplementation?: number;
    key?: string;
}
export interface SqlitePluginDbParams extends SqlitePluginDbOptionalParams {
    name: string;
    location: number;
}
export interface SqliteDatabase {
    openDBs: string[];
    transaction(transaction: CordovaTransaction, error: SqlProviderBase.SQLTransactionErrorCallback, success: SqlProviderBase.SQLTransactionCallback): void;
    readTransaction(transaction: CordovaTransaction, error: SqlProviderBase.SQLTransactionErrorCallback, success: SqlProviderBase.SQLTransactionCallback): void;
    open(success: SqliteSuccessCallback, error: SqliteErrorCallback): void;
    close(success: SqliteSuccessCallback, error: SqliteErrorCallback): void;
    executeSql(statement: string, params?: any[], success?: SqlProviderBase.SQLStatementCallback, error?: SqlProviderBase.SQLStatementErrorCallback): void;
}
export interface SqlitePlugin {
    openDatabase(dbInfo: SqlitePluginDbParams, success?: SqliteSuccessCallback, error?: SqliteErrorCallback): SqliteDatabase;
    deleteDatabase(dbInfo: SqlitePluginDbParams, success?: SqliteSuccessCallback, error?: SqliteErrorCallback): void;
    sqliteFeatures: {
        isSQLitePlugin: boolean;
    };
}
export interface CordovaTransaction extends SqlProviderBase.SQLTransaction {
    abort(err?: any): void;
}
export declare class CordovaNativeSqliteProvider extends SqlProviderBase.SqlProviderBase {
    private _plugin;
    private _openOptions;
    private _lockHelper;
    constructor(_plugin?: SqlitePlugin, _openOptions?: SqlitePluginDbOptionalParams);
    private _db;
    private _dbParams;
    private _closingDefer;
    open(dbName: string, schema: NoSqlProvider.DbSchema, wipeIfExists: boolean, verbose: boolean): SyncTasks.Promise<void>;
    close(): SyncTasks.Promise<void>;
    protected _deleteDatabaseInternal(): SyncTasks.Promise<void>;
    openTransaction(storeNames: string[], writeNeeded: boolean): SyncTasks.Promise<SqlProviderBase.SqlTransaction>;
}
