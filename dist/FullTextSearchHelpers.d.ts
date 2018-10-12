/**
* FullTextSearchHelpers.ts
* Author: David de Regt
* Copyright: Microsoft 2017
*
* Reusable helper classes and functions for supporting Full Text Search.
*/
import SyncTasks = require('synctasks');
import NoSqlProvider = require('./NoSqlProvider');
import { ItemType, KeyType } from './NoSqlProvider';
export declare function breakAndNormalizeSearchPhrase(phrase: string): string[];
export declare function getFullTextIndexWordsForItem(keyPath: string, item: any): string[];
export declare abstract class DbIndexFTSFromRangeQueries implements NoSqlProvider.DbIndex {
    protected _indexSchema: NoSqlProvider.IndexSchema | undefined;
    protected _primaryKeyPath: string | string[];
    protected _keyPath: string | string[];
    constructor(_indexSchema: NoSqlProvider.IndexSchema | undefined, _primaryKeyPath: string | string[]);
    fullTextSearch(searchPhrase: string, resolution?: NoSqlProvider.FullTextTermResolution, limit?: number): SyncTasks.Promise<ItemType[]>;
    abstract getAll(reverseOrSortOrder?: boolean | NoSqlProvider.QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    abstract getOnly(key: KeyType, reverseOrSortOrder?: boolean | NoSqlProvider.QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    abstract getRange(keyLowRange: KeyType, keyHighRange: KeyType, lowRangeExclusive?: boolean, highRangeExclusive?: boolean, reverseOrSortOrder?: boolean | NoSqlProvider.QuerySortOrder, limit?: number, offset?: number): SyncTasks.Promise<ItemType[]>;
    abstract countAll(): SyncTasks.Promise<number>;
    abstract countOnly(key: KeyType): SyncTasks.Promise<number>;
    abstract countRange(keyLowRange: KeyType, keyHighRange: KeyType, lowRangeExclusive?: boolean, highRangeExclusive?: boolean): SyncTasks.Promise<number>;
}
