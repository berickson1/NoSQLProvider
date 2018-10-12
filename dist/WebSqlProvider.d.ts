/**
 * WebSqlProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * NoSqlProvider provider setup for WebSql, a browser storage backing.
 */
import SyncTasks = require('synctasks');
import NoSqlProvider = require('./NoSqlProvider');
import SqlProviderBase = require('./SqlProviderBase');
export interface SQLDatabaseCallback {
    (database: SqlProviderBase.SQLDatabase): void;
}
declare global {
    interface Window {
        openDatabase(database_name: string, database_version: string, database_displayname: string, database_size?: number, creationCallback?: SQLDatabaseCallback): SqlProviderBase.SQLDatabase;
    }
}
export declare class WebSqlProvider extends SqlProviderBase.SqlProviderBase {
    private _db;
    constructor(supportsFTS3?: boolean);
    open(dbName: string, schema: NoSqlProvider.DbSchema, wipeIfExists: boolean, verbose: boolean): SyncTasks.Promise<void>;
    close(): SyncTasks.Promise<void>;
    protected _deleteDatabaseInternal(): SyncTasks.Promise<void>;
    openTransaction(storeNames: string[], writeNeeded: boolean): SyncTasks.Promise<SqlProviderBase.SqlTransaction>;
}
