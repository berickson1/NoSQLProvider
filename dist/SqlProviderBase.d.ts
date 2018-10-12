/**
 * SqlProviderBase.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * Abstract helpers for all NoSqlProvider DbProviders that are based on SQL backings.
 */
import SyncTasks = require('synctasks');
import NoSqlProvider = require('./NoSqlProvider');
export interface SQLVoidCallback {
    (): void;
}
export interface SQLTransactionCallback {
    (transaction: SQLTransaction): void;
}
export interface SQLTransactionErrorCallback {
    (error: SQLError): void;
}
export interface SQLDatabase {
    version: string;
    changeVersion(oldVersion: string, newVersion: string, callback?: SQLTransactionCallback, errorCallback?: SQLTransactionErrorCallback, successCallback?: SQLVoidCallback): void;
    transaction(callback?: SQLTransactionCallback, errorCallback?: SQLTransactionErrorCallback, successCallback?: SQLVoidCallback): void;
    readTransaction(callback?: SQLTransactionCallback, errorCallback?: SQLTransactionErrorCallback, successCallback?: SQLVoidCallback): void;
}
export declare abstract class SqlProviderBase extends NoSqlProvider.DbProvider {
    protected _supportsFTS3: boolean;
    constructor(_supportsFTS3: boolean);
    abstract openTransaction(storeNames: string[] | undefined, writeNeeded: boolean): SyncTasks.Promise<SqlTransaction>;
    private _getMetadata;
    private _storeIndexMetadata;
    private _getDbVersion;
    protected _changeDbVersion(oldVersion: number, newVersion: number): SyncTasks.Promise<SqlTransaction>;
    protected _ourVersionChecker(wipeIfExists: boolean): SyncTasks.Promise<void>;
    protected _upgradeDb(trans: SqlTransaction, oldVersion: number, wipeAnyway: boolean): SyncTasks.Promise<void>;
}
export declare abstract class SqlTransaction implements NoSqlProvider.DbTransaction {
    protected _schema: NoSqlProvider.DbSchema;
    protected _verbose: boolean;
    protected _maxVariables: number;
    private _supportsFTS3;
    private _isOpen;
    constructor(_schema: NoSqlProvider.DbSchema, _verbose: boolean, _maxVariables: number, _supportsFTS3: boolean);
    protected _isTransactionOpen(): boolean;
    internal_markTransactionClosed(): void;
    abstract getCompletionPromise(): SyncTasks.Promise<void>;
    abstract abort(): void;
    abstract runQuery(sql: string, parameters?: any[]): SyncTasks.Promise<any[]>;
    internal_getMaxVariables(): number;
    internal_nonQuery(sql: string, parameters?: any[]): SyncTasks.Promise<void>;
    internal_getResultsFromQuery<T>(sql: string, parameters?: any[]): SyncTasks.Promise<T[]>;
    internal_getResultFromQuery<T>(sql: string, parameters?: any[]): SyncTasks.Promise<T | undefined>;
    getStore(storeName: string): NoSqlProvider.DbStore;
    markCompleted(): void;
    protected _requiresUnicodeReplacement(): boolean;
}
export interface SQLError {
    code: number;
    message: string;
}
export interface SQLResultSet {
    insertId: number;
    rowsAffected: number;
    rows: SQLResultSetRowList;
}
export interface SQLResultSetRowList {
    length: number;
    item(index: number): any;
}
export interface SQLStatementCallback {
    (transaction: SQLTransaction, resultSet: SQLResultSet): void;
}
export interface SQLStatementErrorCallback {
    (transaction: SQLTransaction, error: SQLError): void;
}
export interface SQLTransaction {
    executeSql(sqlStatement: string, args?: any[], callback?: SQLStatementCallback, errorCallback?: SQLStatementErrorCallback): void;
}
export declare abstract class SqliteSqlTransaction extends SqlTransaction {
    protected _trans: SQLTransaction;
    private _pendingQueries;
    constructor(_trans: SQLTransaction, schema: NoSqlProvider.DbSchema, verbose: boolean, maxVariables: number, supportsFTS3: boolean);
    abstract getErrorHandlerReturnValue(): boolean;
    failAllPendingQueries(error: any): void;
    runQuery(sql: string, parameters?: any[]): SyncTasks.Promise<any[]>;
}
