/**
 * NodeSqlite3DbProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * NoSqlProvider provider setup for NodeJs to use a sqlite3-based provider.
 * Can pass :memory: to the dbName for it to use an in-memory sqlite instance that's blown away each close() call.
 */
import SyncTasks = require('synctasks');
import NoSqlProvider = require('./NoSqlProvider');
import SqlProviderBase = require('./SqlProviderBase');
export default class NodeSqlite3DbProvider extends SqlProviderBase.SqlProviderBase {
    private _db;
    private _lockHelper;
    constructor(supportsFTS3?: boolean);
    open(dbName: string, schema: NoSqlProvider.DbSchema, wipeIfExists: boolean, verbose: boolean): SyncTasks.Promise<void>;
    openTransaction(storeNames: string[], writeNeeded: boolean): SyncTasks.Promise<SqlProviderBase.SqlTransaction>;
    close(): SyncTasks.Promise<void>;
    protected _deleteDatabaseInternal(): SyncTasks.Promise<void>;
}
