/**
 * InMemoryProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2015
 *
 * NoSqlProvider provider setup for a non-persisted in-memory database backing provider.
 */
import _ = require('lodash');
import SyncTasks = require('synctasks');
import NoSqlProvider = require('./NoSqlProvider');
import { ItemType } from './NoSqlProvider';
export interface StoreData {
    data: _.Dictionary<ItemType>;
    schema: NoSqlProvider.StoreSchema;
}
export declare class InMemoryProvider extends NoSqlProvider.DbProvider {
    private _stores;
    private _lockHelper;
    open(dbName: string, schema: NoSqlProvider.DbSchema, wipeIfExists: boolean, verbose: boolean): SyncTasks.Promise<void>;
    protected _deleteDatabaseInternal(): SyncTasks.STPromise<void>;
    openTransaction(storeNames: string[], writeNeeded: boolean): SyncTasks.Promise<NoSqlProvider.DbTransaction>;
    close(): SyncTasks.Promise<void>;
    internal_getStore(name: string): StoreData;
}
