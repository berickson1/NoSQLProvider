/**
 * TransactionLockHelper.ts
 * Author: David de Regt
 * Copyright: Microsoft 2017
 *
 * Several of the different providers need various types of help enforcing exclusive/readonly transactions.  This helper keeps
 * store-specific lock info and releases transactions at the right time, when the underlying provider can't handle it.
 */
import SyncTasks = require('synctasks');
import NoSqlProvider = require('./NoSqlProvider');
export interface TransactionToken {
    readonly completionPromise: SyncTasks.Promise<void>;
    readonly storeNames: string[];
    readonly exclusive: boolean;
}
declare class TransactionLockHelper {
    private _schema;
    private _supportsDiscreteTransactions;
    private _closingDefer;
    private _closed;
    private _exclusiveLocks;
    private _readOnlyCounts;
    private _pendingTransactions;
    constructor(_schema: NoSqlProvider.DbSchema, _supportsDiscreteTransactions: boolean);
    closeWhenPossible(): SyncTasks.Promise<void>;
    private _checkClose;
    hasTransaction(): boolean;
    openTransaction(storeNames: string[] | undefined, exclusive: boolean): SyncTasks.Promise<TransactionToken>;
    transactionComplete(token: TransactionToken): void;
    transactionFailed(token: TransactionToken, message: string): void;
    private _cleanTransaction;
    private _checkNextTransactions;
}
export default TransactionLockHelper;
