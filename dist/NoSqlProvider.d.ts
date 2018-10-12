/**
 * NoSqlProvider.ts
 * Author: David de Regt
 * Copyright: Microsoft 2016
 *
 * Low-level wrapper to expose a nosql-like database which can be backed by
 * numerous different backend store types, invisible to the consumer.  The
 * usage semantics are very similar to IndexedDB.  This file contains most
 * of the helper interfaces, while the specific database providers should
 * be required piecemeal.
 */
import SyncTasks = require('synctasks');
export declare type ItemType = object;
export declare type KeyComponentType = string | number | Date;
export declare type KeyType = KeyComponentType | KeyComponentType[];
export declare type KeyPathType = string | string[];
export declare enum QuerySortOrder {
    None = 0,
    Forward = 1,
    Reverse = 2
}
export interface IndexSchema {
    name: string;
    keyPath: KeyPathType;
    unique?: boolean;
    multiEntry?: boolean;
    fullText?: boolean;
    includeDataInIndex?: boolean;
    doNotBackfill?: boolean;
}
export interface StoreSchema {
    name: string;
    indexes?: IndexSchema[];
    primaryKeyPath: KeyPathType;
    estimatedObjBytes?: number;
}
export interface DbSchema {
    version: number;
    lastUsableVersion?: number;
    stores: StoreSchema[];
}
export declare enum FullTextTermResolution {
    And = 0,
    Or = 1
}
export interface DbIndex {
    getAll(reverseOrSortOrder?: boolean | QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    getOnly(key: KeyType, reverseOrSortOrder?: boolean | QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    getRange(keyLowRange: KeyType, keyHighRange: KeyType, lowRangeExclusive?: boolean, highRangeExclusive?: boolean, reverseOrSortOrder?: boolean | QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    countAll(): SyncTasks.Promise<number>;
    countOnly(key: KeyType): SyncTasks.Promise<number>;
    countRange(keyLowRange: KeyType, keyHighRange: KeyType, lowRangeExclusive?: boolean, highRangeExclusive?: boolean): SyncTasks.Promise<number>;
    fullTextSearch(searchPhrase: string, resolution?: FullTextTermResolution, limit?: number): SyncTasks.Promise<ItemType[]>;
}
export interface DbStore {
    get(key: KeyType): SyncTasks.Promise<ItemType | undefined>;
    getMultiple(keyOrKeys: KeyType | KeyType[]): SyncTasks.Promise<ItemType[]>;
    put(itemOrItems: ItemType | ItemType[]): SyncTasks.Promise<void>;
    remove(keyOrKeys: KeyType | KeyType[]): SyncTasks.Promise<void>;
    openPrimaryKey(): DbIndex;
    openIndex(indexName: string): DbIndex;
    clearAllData(): SyncTasks.Promise<void>;
}
export interface DbTransaction {
    getStore(storeName: string): DbStore;
    getCompletionPromise(): SyncTasks.Promise<void>;
    abort(): void;
    markCompleted(): void;
}
export declare abstract class DbProvider {
    protected _dbName: string | undefined;
    protected _schema: DbSchema | undefined;
    protected _verbose: boolean | undefined;
    open(dbName: string, schema: DbSchema, wipeIfExists: boolean, verbose: boolean): SyncTasks.Promise<void>;
    abstract close(): SyncTasks.Promise<void>;
    abstract openTransaction(storeNames: string[] | undefined, writeNeeded: boolean): SyncTasks.Promise<DbTransaction>;
    deleteDatabase(): SyncTasks.Promise<void>;
    clearAllData(): SyncTasks.Promise<void>;
    protected abstract _deleteDatabaseInternal(): SyncTasks.Promise<void>;
    private _getStoreTransaction;
    get(storeName: string, key: KeyType): SyncTasks.Promise<ItemType | undefined>;
    getMultiple(storeName: string, keyOrKeys: KeyType | KeyType[]): SyncTasks.Promise<ItemType[]>;
    put(storeName: string, itemOrItems: ItemType | ItemType[]): SyncTasks.Promise<void>;
    remove(storeName: string, keyOrKeys: KeyType | KeyType[]): SyncTasks.Promise<void>;
    private _getStoreIndexTransaction;
    getAll(storeName: string, indexName: string | undefined, reverseOrSortOrder?: boolean | QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    getOnly(storeName: string, indexName: string | undefined, key: KeyType, reverseOrSortOrder?: boolean | QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    getRange(storeName: string, indexName: string | undefined, keyLowRange: KeyType, keyHighRange: KeyType, lowRangeExclusive?: boolean, highRangeExclusive?: boolean, reverseOrSortOrder?: boolean | QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    countAll(storeName: string, indexName: string | undefined): SyncTasks.Promise<number>;
    countOnly(storeName: string, indexName: string | undefined, key: KeyType): SyncTasks.Promise<number>;
    countRange(storeName: string, indexName: string | undefined, keyLowRange: KeyType, keyHighRange: KeyType, lowRangeExclusive?: boolean, highRangeExclusive?: boolean): SyncTasks.Promise<number>;
    fullTextSearch(storeName: string, indexName: string, searchPhrase: string, resolution?: FullTextTermResolution, limit?: number): SyncTasks.Promise<ItemType[]>;
}
export declare function openListOfProviders(providersToTry: DbProvider[], dbName: string, schema: DbSchema, wipeIfExists?: boolean, verbose?: boolean): SyncTasks.Promise<DbProvider>;
