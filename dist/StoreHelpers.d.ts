/**
* StoreHelpers.ts
* Author: David de Regt
* Copyright: Microsoft 2017
*
* Reusable helper classes for clients of NoSqlProvider to build more type-safe stores/indexes.
*/
import SyncTasks = require('synctasks');
import NoSqlProvider = require('./NoSqlProvider');
import { ItemType, KeyType } from './NoSqlProvider';
export declare var ErrorCatcher: ((err: any) => SyncTasks.Promise<any>) | undefined;
export declare type DBStore<Name extends string, ObjectType, KeyFormat> = string & {
    name?: Name;
    objectType?: ObjectType;
    keyFormat?: KeyFormat;
};
export declare type DBIndex<Store extends DBStore<string, any, any>, IndexKeyFormat> = string & {
    store?: Store;
    indexKeyFormat?: IndexKeyFormat;
};
export declare class SimpleTransactionIndexHelper<ObjectType extends ItemType, IndexKeyFormat extends KeyType> {
    protected _index: NoSqlProvider.DbIndex;
    constructor(_index: NoSqlProvider.DbIndex);
    getAll(reverseOrSortOrder?: boolean | NoSqlProvider.QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ObjectType[]>;
    getOnly(key: IndexKeyFormat, reverseOrSortOrder?: boolean | NoSqlProvider.QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ObjectType[]>;
    getRange(keyLowRange: IndexKeyFormat, keyHighRange: IndexKeyFormat, lowRangeExclusive?: boolean, highRangeExclusive?: boolean, reverseOrSortOrder?: boolean | NoSqlProvider.QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ObjectType[]>;
    countAll(): SyncTasks.Promise<number>;
    countOnly(key: IndexKeyFormat): SyncTasks.Promise<number>;
    countRange(keyLowRange: IndexKeyFormat, keyHighRange: IndexKeyFormat, lowRangeExclusive?: boolean, highRangeExclusive?: boolean): SyncTasks.Promise<number>;
    fullTextSearch(searchPhrase: string, resolution?: NoSqlProvider.FullTextTermResolution, limit?: number): SyncTasks.Promise<ObjectType[]>;
}
export declare class SimpleTransactionStoreHelper<StoreName extends string, ObjectType extends ItemType, KeyFormat extends KeyType> {
    protected _store: NoSqlProvider.DbStore;
    constructor(_store: NoSqlProvider.DbStore, storeName: DBStore<StoreName, ObjectType, KeyFormat>);
    get(key: KeyFormat): SyncTasks.Promise<ObjectType | undefined>;
    getAll(): SyncTasks.Promise<ObjectType[]>;
    getOnly(key: KeyFormat, reverseOrSortOrder?: boolean | NoSqlProvider.QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ObjectType[]>;
    getRange(keyLowRange: KeyFormat, keyHighRange: KeyFormat, lowRangeExclusive?: boolean, highRangeExclusive?: boolean, reverseOrSortOrder?: boolean | NoSqlProvider.QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ObjectType[]>;
    getMultiple(keyOrKeys: KeyFormat | KeyFormat[]): SyncTasks.Promise<ObjectType[]>;
    openIndex<IndexKeyFormat extends KeyType>(indexName: DBIndex<DBStore<StoreName, ObjectType, KeyFormat>, IndexKeyFormat>): SimpleTransactionIndexHelper<ObjectType, IndexKeyFormat>;
    openPrimaryKey(): SimpleTransactionIndexHelper<ObjectType, KeyFormat>;
    put(itemOrItems: ObjectType | ReadonlyArray<ObjectType>): SyncTasks.Promise<void>;
    remove(keyOrKeys: KeyFormat | KeyFormat[]): SyncTasks.Promise<void>;
    clearAllData(): SyncTasks.Promise<void>;
}
