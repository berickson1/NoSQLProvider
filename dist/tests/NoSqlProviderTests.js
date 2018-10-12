"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var _ = require("lodash");
var sinon = require("sinon");
var SyncTasks = require("synctasks");
var NoSqlProvider = require("../NoSqlProvider");
// import { CordovaNativeSqliteProvider } from '../CordovaNativeSqliteProvider';
var InMemoryProvider_1 = require("../InMemoryProvider");
var IndexedDbProvider_1 = require("../IndexedDbProvider");
var WebSqlProvider_1 = require("../WebSqlProvider");
var NoSqlProviderUtils = require("../NoSqlProviderUtils");
var SqlProviderBase_1 = require("../SqlProviderBase");
// Don't trap exceptions so we immediately see them with a stack trace
SyncTasks.config.catchExceptions = false;
var cleanupFile = false;
function openProvider(providerName, schema, wipeFirst) {
    var provider;
    if (providerName === 'sqlite3memory') {
        var NSPNodeSqlite3DbProvider = require('../NodeSqlite3DbProvider');
        provider = new NSPNodeSqlite3DbProvider.default();
    }
    else if (providerName === 'sqlite3memorynofts3') {
        var NSPNodeSqlite3DbProvider = require('../NodeSqlite3DbProvider');
        provider = new NSPNodeSqlite3DbProvider.default(false);
    }
    else if (providerName === 'sqlite3disk') {
        cleanupFile = true;
        var NSPNodeSqlite3DbProvider = require('../NodeSqlite3DbProvider');
        provider = new NSPNodeSqlite3DbProvider.default();
    }
    else if (providerName === 'sqlite3disknofts3') {
        cleanupFile = true;
        var NSPNodeSqlite3DbProvider = require('../NodeSqlite3DbProvider');
        provider = new NSPNodeSqlite3DbProvider.default(false);
    }
    else if (providerName === 'memory') {
        provider = new InMemoryProvider_1.InMemoryProvider();
    }
    else if (providerName === 'indexeddb') {
        provider = new IndexedDbProvider_1.IndexedDbProvider();
    }
    else if (providerName === 'indexeddbfakekeys') {
        provider = new IndexedDbProvider_1.IndexedDbProvider(undefined, false);
    }
    else if (providerName === 'websql') {
        provider = new WebSqlProvider_1.WebSqlProvider();
    }
    else if (providerName === 'websqlnofts3') {
        provider = new WebSqlProvider_1.WebSqlProvider(false);
        // } else if (providerName === 'reactnative') {
        //     var reactNativeSqliteProvider = require('react-native-sqlite-storage');
        //     provider = new CordovaNativeSqliteProvider(reactNativeSqliteProvider);
    }
    else {
        throw new Error('Provider not found for name: ' + providerName);
    }
    var dbName = providerName.indexOf('sqlite3memory') !== -1 ? ':memory:' : 'test';
    return NoSqlProvider.openListOfProviders([provider], dbName, schema, wipeFirst, false);
}
function sleep(timeMs) {
    var defer = SyncTasks.Defer();
    setTimeout(function () { defer.resolve(void 0); }, timeMs);
    return defer.promise();
}
describe('NoSqlProvider', function () {
    //this.timeout(60000);
    after(function (callback) {
        if (cleanupFile) {
            var fs = require('fs');
            fs.unlink('test', function (err) {
                if (err) {
                    throw err;
                }
                console.log('path/file.txt was deleted');
                callback();
            });
        }
    });
    var provsToTest;
    if (typeof window === 'undefined') {
        // Non-browser environment...
        provsToTest = ['memory', 'sqlite3memory', 'sqlite3memorynofts3', 'sqlite3disk', 'sqlite3disknofts3'];
    }
    else {
        provsToTest = ['memory'];
        if (!NoSqlProviderUtils.isSafari()) {
            // Safari has broken indexeddb support, so let's not test it there.  Everywhere else should have it.
            // In IE, indexeddb will auto-run in fake keys mode, so if all is working, this is 2x the same test (but let's make sure!)
            provsToTest.push('indexeddb', 'indexeddbfakekeys');
        }
        if (window.openDatabase) {
            // WebSQL theoretically supported!
            provsToTest.push('websql', 'websqlnofts3');
        }
    }
    it('Number/value/type sorting', function () {
        var pairsToTest = [
            [0, 1],
            [-1, 1],
            [100, 100.1],
            [-123456.789, -123456.78],
            [-123456.789, 0],
            [-123456.789, 123456.789],
            [0.000012345, 8],
            [0.000012345, 0.00002],
            [-0.000012345, 0.000000001],
            [1, Date.now()],
            [new Date(0), new Date(2)],
            [new Date(1), new Date(2)],
            [new Date(-1), new Date(1)],
            [new Date(-2), new Date(-1)],
            [new Date(-2), new Date(0)],
            [1, 'hi'],
            [-1, 'hi'],
            [Date.now(), 'hi'],
            ['hi', 'hi2'],
            ['a', 'b']
        ];
        pairsToTest.forEach(function (pair) {
            assert(NoSqlProviderUtils.serializeValueToOrderableString(pair[0]) <
                NoSqlProviderUtils.serializeValueToOrderableString(pair[1]), 'failed for pair: ' + pair);
        });
        try {
            NoSqlProviderUtils.serializeValueToOrderableString([4, 5]);
            assert(false, 'Should reject this key');
        }
        catch (e) {
            // Should throw -- expecting this result.
        }
    });
    provsToTest.forEach(function (provName) {
        describe('Provider: ' + provName, function () {
            describe('Delete database', function () {
                if (provName.indexOf('memory') !== -1) {
                    xit('Skip delete test for in memory DB', function () {
                        //noop
                    });
                }
                else if (provName.indexOf('indexeddb') === 0) {
                    it('Deletes the database', function () {
                        var schema = {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        };
                        return openProvider(provName, schema, true)
                            .then(function (prov) {
                            // insert some stuff
                            return prov.put('test', { id: 'a', val: 'b' })
                                //then delete
                                .then(function () { return prov.deleteDatabase(); });
                        })
                            .then(function () { return openProvider(provName, schema, false); })
                            .then(function (prov) {
                            return prov.get('test', 'a').then(function (retVal) {
                                var ret = retVal;
                                // not found
                                assert(!ret);
                                return prov.close();
                            });
                        });
                    });
                }
                else {
                    it('Rejects with an error', function () {
                        var schema = {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        };
                        return openProvider(provName, schema, true).
                            then(function (prov) {
                            // insert some stuff
                            return prov.put('test', { id: 'a', val: 'b' })
                                .then(function () { return prov.deleteDatabase(); });
                        })
                            .then(function () {
                            //this should not happen
                            assert(false, 'Should fail');
                        }).catch(function () {
                            // as expected, didn't delete anything
                            return openProvider(provName, schema, false)
                                .then(function (prov) { return prov.get('test', 'a').then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.val, 'b');
                                return prov.close();
                            }); });
                        });
                    });
                }
            });
            describe('Data Manipulation', function () {
                // Setter should set the testable parameter on the first param to the value in the second param, and third param to the
                // second index column for compound indexes.
                var tester = function (prov, indexName, compound, setter) {
                    var putters = [1, 2, 3, 4, 5].map(function (v) {
                        var obj = { val: 'val' + v };
                        if (indexName) {
                            obj.id = 'id' + v;
                        }
                        setter(obj, 'indexa' + v, 'indexb' + v);
                        return prov.put('test', obj);
                    });
                    return SyncTasks.all(putters).then(function (rets) {
                        var formIndex = function (i, i2) {
                            if (i2 === void 0) { i2 = i; }
                            if (compound) {
                                return ['indexa' + i, 'indexb' + i2];
                            }
                            else {
                                return 'indexa' + i;
                            }
                        };
                        var t1 = prov.getAll('test', indexName).then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 5, 'getAll');
                            [1, 2, 3, 4, 5].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; }), 'cant find ' + v); });
                        });
                        var t1count = prov.countAll('test', indexName).then(function (ret) {
                            assert.equal(ret, 5, 'countAll');
                        });
                        var t1b = prov.getAll('test', indexName, false, 3).then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 3, 'getAll lim3');
                            [1, 2, 3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; }), 'cant find ' + v); });
                        });
                        var t1c = prov.getAll('test', indexName, false, 3, 1).then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 3, 'getAll lim3 off1');
                            [2, 3, 4].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; }), 'cant find ' + v); });
                        });
                        var t2 = prov.getOnly('test', indexName, formIndex(3)).then(function (ret) {
                            assert.equal(ret.length, 1, 'getOnly');
                            assert.equal(ret[0].val, 'val3');
                        });
                        var t2count = prov.countOnly('test', indexName, formIndex(3)).then(function (ret) {
                            assert.equal(ret, 1, 'countOnly');
                        });
                        var t3 = prov.getRange('test', indexName, formIndex(2), formIndex(4)).then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 3, 'getRange++');
                            [2, 3, 4].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3count = prov.countRange('test', indexName, formIndex(2), formIndex(4)).then(function (ret) {
                            assert.equal(ret, 3, 'countRange++');
                        });
                        var t3b = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, false, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 1, 'getRange++ lim1');
                            [2].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3b2 = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, false, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 1, 'getRange++ lim1');
                            [2].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3b3 = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, NoSqlProvider.QuerySortOrder.Forward, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 1, 'getRange++ lim1');
                            [2].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3b4 = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, NoSqlProvider.QuerySortOrder.Reverse, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 1, 'getRange++ lim1 rev');
                            [4].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3c = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, false, 1, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 1, 'getRange++ lim1 off1');
                            [3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3d = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, false, 2, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 2, 'getRange++ lim2 off1');
                            [3, 4].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3d2 = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, NoSqlProvider.QuerySortOrder.Forward, 2, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 2, 'getRange++ lim2 off1');
                            [3, 4].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3d3 = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, true, 2, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 2, 'getRange++ lim2 off1 rev');
                            assert.equal(ret[0].val, 'val3');
                            [2, 3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t3d4 = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, false, NoSqlProvider.QuerySortOrder.Reverse, 2, 1)
                            .then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 2, 'getRange++ lim2 off1 rev');
                            assert.equal(ret[0].val, 'val3');
                            [2, 3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t4 = prov.getRange('test', indexName, formIndex(2), formIndex(4), true, false).then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 2, 'getRange-+');
                            [3, 4].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t4count = prov.countRange('test', indexName, formIndex(2), formIndex(4), true, false).then(function (ret) {
                            assert.equal(ret, 2, 'countRange-+');
                        });
                        var t5 = prov.getRange('test', indexName, formIndex(2), formIndex(4), false, true).then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 2, 'getRange+-');
                            [2, 3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t5count = prov.countRange('test', indexName, formIndex(2), formIndex(4), false, true).then(function (ret) {
                            assert.equal(ret, 2, 'countRange+-');
                        });
                        var t6 = prov.getRange('test', indexName, formIndex(2), formIndex(4), true, true).then(function (retVal) {
                            var ret = retVal;
                            assert.equal(ret.length, 1, 'getRange--');
                            [3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                        });
                        var t6count = prov.countRange('test', indexName, formIndex(2), formIndex(4), true, true).then(function (ret) {
                            assert.equal(ret, 1, 'countRange--');
                        });
                        return SyncTasks.all([t1, t1count, t1b, t1c, t2, t2count, t3, t3count, t3b, t3b2, t3b3, t3b4, t3c, t3d, t3d2, t3d3,
                            t3d4, t4, t4count, t5, t5count, t6, t6count]).then(function () {
                            if (compound) {
                                var tt1 = prov.getRange('test', indexName, formIndex(2, 2), formIndex(4, 3))
                                    .then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.length, 2, 'getRange2++');
                                    [2, 3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                                });
                                var tt1count = prov.countRange('test', indexName, formIndex(2, 2), formIndex(4, 3))
                                    .then(function (ret) {
                                    assert.equal(ret, 2, 'countRange2++');
                                });
                                var tt2 = prov.getRange('test', indexName, formIndex(2, 2), formIndex(4, 3), false, true)
                                    .then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.length, 2, 'getRange2+-');
                                    [2, 3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                                });
                                var tt2count = prov.countRange('test', indexName, formIndex(2, 2), formIndex(4, 3), false, true)
                                    .then(function (ret) {
                                    assert.equal(ret, 2, 'countRange2+-');
                                });
                                var tt3 = prov.getRange('test', indexName, formIndex(2, 2), formIndex(4, 3), true, false)
                                    .then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.length, 1, 'getRange2-+');
                                    [3].forEach(function (v) { assert(_.find(ret, function (r) { return r.val === 'val' + v; })); });
                                });
                                var tt3count = prov.countRange('test', indexName, formIndex(2, 2), formIndex(4, 3), true, false)
                                    .then(function (ret) {
                                    assert.equal(ret, 1, 'countRange2-+');
                                });
                                return SyncTasks.all([tt1, tt1count, tt2, tt2count, tt3, tt3count]).then(function () {
                                    return prov.close();
                                });
                            }
                            else {
                                return prov.close();
                            }
                        });
                    });
                };
                it('Simple primary key put/get/getAll', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id'
                            }
                        ]
                    }, true).then(function (prov) {
                        return prov.put('test', { id: 'a', val: 'b' }).then(function () {
                            return prov.get('test', 'a').then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.val, 'b');
                                return prov.getAll('test', undefined).then(function (ret2Val) {
                                    var ret2 = ret2Val;
                                    assert.equal(ret2.length, 1);
                                    assert.equal(ret2[0].val, 'b');
                                    return prov.close();
                                });
                            });
                        });
                    });
                });
                it('Empty gets/puts', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id'
                            }
                        ]
                    }, true).then(function (prov) {
                        return prov.put('test', []).then(function () {
                            return prov.getAll('test', undefined).then(function (rets) {
                                assert(!!rets);
                                assert.equal(rets.length, 0);
                                return prov.getMultiple('test', []).then(function (rets) {
                                    assert(!!rets);
                                    assert.equal(rets.length, 0);
                                    return prov.close();
                                });
                            });
                        });
                    });
                });
                it('getMultiple with blank', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id'
                            }
                        ]
                    }, true).then(function (prov) {
                        return prov.put('test', [1, 3].map(function (i) { return { id: 'a' + i }; })).then(function () {
                            return prov.getMultiple('test', ['a1', 'a2', 'a3']).then(function (rets) {
                                assert(!!rets);
                                assert.equal(rets.length, 2);
                                return prov.close();
                            });
                        });
                    });
                });
                it('Removing items', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id'
                            }
                        ]
                    }, true).then(function (prov) {
                        return prov.put('test', [1, 2, 3, 4, 5].map(function (i) { return { id: 'a' + i }; })).then(function () {
                            return prov.getAll('test', undefined).then(function (rets) {
                                assert(!!rets);
                                assert.equal(rets.length, 5);
                                return prov.remove('test', 'a1').then(function () {
                                    return prov.getAll('test', undefined).then(function (rets) {
                                        assert(!!rets);
                                        assert.equal(rets.length, 4);
                                        return prov.remove('test', ['a3', 'a4', 'a2']).then(function () {
                                            return prov.getAll('test', undefined).then(function (retVals) {
                                                var rets = retVals;
                                                assert(!!rets);
                                                assert.equal(rets.length, 1);
                                                assert.equal(rets[0].id, 'a5');
                                                return prov.close();
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
                it('Invalid Key Type', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id'
                            }
                        ]
                    }, true).then(function (prov) {
                        return prov.put('test', { id: { x: 'a' }, val: 'b' }).then(function () {
                            assert(false, 'Shouldn\'t get here');
                        }, function (err) {
                            // Woot, failed like it's supposed to
                            return prov.close();
                        });
                    });
                });
                it('Primary Key Basic KeyPath', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id'
                            }
                        ]
                    }, true).then(function (prov) {
                        return tester(prov, undefined, false, function (obj, v) { obj.id = v; });
                    });
                });
                var _loop_1 = function (i) {
                    it('Simple index put/get, getAll, getOnly, and getRange' + (i === 0 ? '' : ' (includeData)'), function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [
                                        {
                                            name: 'index',
                                            keyPath: 'a',
                                            includeDataInIndex: i === 1
                                        }
                                    ]
                                }
                            ]
                        }, true).then(function (prov) {
                            return tester(prov, 'index', false, function (obj, v) { obj.a = v; });
                        });
                    });
                };
                for (var i = 0; i <= 1; i++) {
                    _loop_1(i);
                }
                it('Multipart primary key basic test', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'a.b'
                            }
                        ]
                    }, true).then(function (prov) {
                        return tester(prov, undefined, false, function (obj, v) { obj.a = { b: v }; });
                    });
                });
                it('Multipart index basic test', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id',
                                indexes: [
                                    {
                                        name: 'index',
                                        keyPath: 'a.b'
                                    }
                                ]
                            }
                        ]
                    }, true).then(function (prov) {
                        return tester(prov, 'index', false, function (obj, v) { obj.a = { b: v }; });
                    });
                });
                it('Compound primary key basic test', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: ['a', 'b']
                            }
                        ]
                    }, true).then(function (prov) {
                        return tester(prov, undefined, true, function (obj, v1, v2) { obj.a = v1; obj.b = v2; });
                    });
                });
                it('Compound index basic test', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id',
                                indexes: [
                                    {
                                        name: 'index',
                                        keyPath: ['a', 'b']
                                    }
                                ]
                            }
                        ]
                    }, true).then(function (prov) {
                        return tester(prov, 'index', true, function (obj, v1, v2) { obj.a = v1; obj.b = v2; });
                    });
                });
                var _loop_2 = function (i) {
                    it('MultiEntry multipart indexed tests' + (i === 0 ? '' : ' (includeData)'), function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [
                                        {
                                            name: 'key',
                                            multiEntry: true,
                                            keyPath: 'k.k',
                                            includeDataInIndex: i === 1
                                        }
                                    ]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'a', val: 'b', k: { k: ['w', 'x', 'y', 'z'] } })
                                // Insert data without multi-entry key defined
                                .then(function () { return prov.put('test', { id: 'c', val: 'd', k: [] }); })
                                .then(function () { return prov.put('test', { id: 'e', val: 'f' }); })
                                .then(function () {
                                var g1 = prov.get('test', 'a').then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.val, 'b');
                                });
                                var g2 = prov.getAll('test', 'key').then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.length, 4);
                                    ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                                });
                                var g2b = prov.getAll('test', 'key', false, 2).then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.length, 2);
                                    ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                                });
                                var g2c = prov.getAll('test', 'key', false, 2, 1).then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.length, 2);
                                    ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                                });
                                var g3 = prov.getOnly('test', 'key', 'x').then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.length, 1);
                                    assert.equal(ret[0].val, 'b');
                                });
                                var g4 = prov.getRange('test', 'key', 'x', 'y', false, false).then(function (retVal) {
                                    var ret = retVal;
                                    assert.equal(ret.length, 2);
                                    ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                                });
                                return SyncTasks.all([g1, g2, g2b, g2c, g3, g4]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                };
                for (var i = 0; i <= 1; i++) {
                    _loop_2(i);
                }
                it('MultiEntry multipart indexed - update index', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: 'id',
                                indexes: [
                                    {
                                        name: 'key',
                                        multiEntry: true,
                                        keyPath: 'k.k'
                                    }
                                ]
                            }
                        ]
                    }, true).then(function (prov) {
                        return prov.put('test', { id: 'a', val: 'b', k: { k: ['w', 'x', 'y', 'z'] } })
                            .then(function () {
                            return prov.getRange('test', 'key', 'x', 'y', false, false).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 2);
                                ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                            });
                        })
                            .then(function () {
                            return prov.put('test', { id: 'a', val: 'b', k: { k: ['z'] } });
                        })
                            .then(function () {
                            return prov.getRange('test', 'key', 'x', 'y', false, false).then(function (ret) {
                                assert.equal(ret.length, 0);
                            });
                        })
                            .then(function () {
                            return prov.getRange('test', 'key', 'x', 'z', false, false).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 1);
                                assert.equal(ret[0].val, 'b');
                            });
                        })
                            .then(function () {
                            return prov.remove('test', 'a');
                        })
                            .then(function () {
                            return prov.getRange('test', 'key', 'x', 'z', false, false).then(function (ret) {
                                assert.equal(ret.length, 0);
                            });
                        })
                            .then(function () {
                            return prov.close();
                        });
                    });
                });
                it('MultiEntry multipart indexed tests - Compound Key', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: ['id', 'id2'],
                                indexes: [
                                    {
                                        name: 'key',
                                        multiEntry: true,
                                        keyPath: 'k.k'
                                    }
                                ]
                            }
                        ]
                    }, true).then(function (prov) {
                        return prov.put('test', { id: 'a', id2: '1', val: 'b', k: { k: ['w', 'x', 'y', 'z'] } })
                            // Insert data without multi-entry key defined
                            .then(function () { return prov.put('test', { id: 'c', id2: '2', val: 'd', k: [] }); })
                            .then(function () { return prov.put('test', { id: 'e', id2: '3', val: 'f' }); })
                            .then(function () {
                            var g1 = prov.get('test', ['a', '1']).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.val, 'b');
                            });
                            var g2 = prov.getAll('test', 'key').then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 4);
                                ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                            });
                            var g2b = prov.getAll('test', 'key', false, 2).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 2);
                                ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                            });
                            var g2c = prov.getAll('test', 'key', false, 2, 1).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 2);
                                ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                            });
                            var g3 = prov.getOnly('test', 'key', 'x').then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 1);
                                assert.equal(ret[0].val, 'b');
                            });
                            var g4 = prov.getRange('test', 'key', 'x', 'y', false, false).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 2);
                                ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                            });
                            return SyncTasks.all([g1, g2, g2b, g2c, g3, g4]).then(function () {
                                return prov.close();
                            });
                        });
                    });
                });
                it('MultiEntry multipart indexed - update index - Compound', function () {
                    return openProvider(provName, {
                        version: 1,
                        stores: [
                            {
                                name: 'test',
                                primaryKeyPath: ['id', 'id2'],
                                indexes: [
                                    {
                                        name: 'key',
                                        multiEntry: true,
                                        keyPath: 'k.k'
                                    }
                                ]
                            }
                        ]
                    }, true).then(function (prov) {
                        return prov.put('test', { id: 'a', id2: '1', val: 'b', k: { k: ['w', 'x', 'y', 'z'] } })
                            .then(function () {
                            return prov.getRange('test', 'key', 'x', 'y', false, false).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 2);
                                ret.forEach(function (r) { assert.equal(r.val, 'b'); });
                            });
                        })
                            .then(function () {
                            return prov.put('test', { id: 'a', id2: '1', val: 'b', k: { k: ['z'] } });
                        })
                            .then(function () {
                            return prov.getRange('test', 'key', 'x', 'y', false, false).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 0);
                            });
                        })
                            .then(function () {
                            return prov.getRange('test', 'key', 'x', 'z', false, false).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 1);
                                assert.equal(ret[0].val, 'b');
                            });
                        })
                            .then(function () {
                            return prov.remove('test', ['a', '1']);
                        })
                            .then(function () {
                            return prov.getRange('test', 'key', 'x', 'z', false, false).then(function (retVal) {
                                var ret = retVal;
                                assert.equal(ret.length, 0);
                            });
                        })
                            .then(function () {
                            return prov.close();
                        });
                    });
                });
                describe('Transaction Semantics', function () {
                    it('Testing transaction expiration', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.openTransaction(['test'], true).then(function (trans) {
                                var promise = trans.getCompletionPromise();
                                var check1 = false;
                                promise.then(function () {
                                    check1 = true;
                                }, function (err) {
                                    assert.ok(false, 'Bad');
                                });
                                return sleep(200).then(function () {
                                    assert.ok(check1);
                                    var store = trans.getStore('test');
                                    return store.put({ id: 'abc', a: 'a' });
                                });
                            }).then(function () {
                                assert.ok(false, 'Should fail');
                                return SyncTasks.Rejected();
                            }, function (err) {
                                // woot
                                return undefined;
                            }).then(function () {
                                return prov.close();
                            });
                        });
                    });
                    it('Testing aborting', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            var checked = false;
                            return prov.openTransaction(['test'], true).then(function (trans) {
                                var promise = trans.getCompletionPromise();
                                var store = trans.getStore('test');
                                return store.put({ id: 'abc', a: 'a' }).then(function () {
                                    trans.abort();
                                    return promise.then(function () {
                                        assert.ok(false, 'Should fail');
                                    }, function (err) {
                                        return prov.get('test', 'abc').then(function (res) {
                                            assert.ok(!res);
                                            checked = true;
                                        });
                                    });
                                });
                            }).then(function () {
                                assert.ok(checked);
                                return prov.close();
                            });
                        });
                    });
                    it('Testing read/write transaction locks', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', a: 'a' }).then(function () {
                                var check1 = false, check2 = false;
                                var started1 = false;
                                var closed1 = false;
                                var p1 = prov.openTransaction(['test'], true).then(function (trans) {
                                    trans.getCompletionPromise().then(function () {
                                        closed1 = true;
                                    });
                                    started1 = true;
                                    var store = trans.getStore('test');
                                    return store.put({ id: 'abc', a: 'b' }).then(function () {
                                        return store.get('abc').then(function (val) {
                                            assert.ok(val && val.a === 'b');
                                            assert.ok(!closed1);
                                            check1 = true;
                                        });
                                    });
                                });
                                assert.ok(!closed1);
                                var p2 = prov.openTransaction(['test'], false).then(function (trans) {
                                    assert.ok(closed1);
                                    assert.ok(started1 && check1);
                                    var store = trans.getStore('test');
                                    return store.get('abc').then(function (val) {
                                        assert.ok(val && val.a === 'b');
                                        check2 = true;
                                    });
                                });
                                return SyncTasks.all([p1, p2]).then(function () {
                                    assert.ok(check1 && check2);
                                });
                            }).then(function () {
                                return prov.close();
                            });
                        });
                    });
                });
            });
            if (provName.indexOf('memory') === -1) {
                describe('Schema Upgrades', function () {
                    it('Opening an older DB version', function () {
                        return openProvider(provName, {
                            version: 2,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.close();
                        }).then(function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test2',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, false).then(function (prov) {
                                return prov.get('test', 'abc').then(function (item) {
                                    return prov.close().then(function () {
                                        return SyncTasks.Rejected('Shouldn\'t have worked');
                                    });
                                }, function () {
                                    // Expected to fail, so chain from failure to success
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Basic NOOP schema upgrade path', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, false).then(function (prov) {
                                return prov.get('test', 'abc').then(function (item) {
                                    assert(!!item);
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Adding new store', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    },
                                    {
                                        name: 'test2',
                                        primaryKeyPath: 'ttt'
                                    }
                                ]
                            }, false).then(function (prov) {
                                return prov.put('test2', { id: 'def', ttt: 'ghi' }).then(function () {
                                    var p1 = prov.get('test', 'abc').then(function (itemVal) {
                                        var item = itemVal;
                                        assert(!!item);
                                        assert.equal(item.id, 'abc');
                                    });
                                    var p2 = prov.get('test2', 'abc').then(function (item) {
                                        assert(!item);
                                    });
                                    var p3 = prov.get('test2', 'def').then(function (item) {
                                        assert(!item);
                                    });
                                    var p4 = prov.get('test2', 'ghi').then(function (itemVal) {
                                        var item = itemVal;
                                        assert(!!item);
                                        assert.equal(item.id, 'def');
                                    });
                                    return SyncTasks.all([p1, p2, p3, p4]).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                    });
                    it('Removing old store', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test2',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, false).then(function (prov) {
                                return prov.get('test', 'abc').then(function (item) {
                                    return prov.close().then(function () {
                                        return SyncTasks.Rejected('Shouldn\'t have worked');
                                    });
                                }, function () {
                                    // Expected to fail, so chain from failure to success
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Remove store with index', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [{
                                            name: 'ind1',
                                            keyPath: 'tt'
                                        }]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: 'abc' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test2',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, false).then(function (prov) {
                                return prov.get('test', 'abc').then(function (item) {
                                    return prov.close().then(function () {
                                        return SyncTasks.Rejected('Shouldn\'t have worked');
                                    });
                                }, function () {
                                    // Expected to fail, so chain from failure to success
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Add index', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: 'a' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt'
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                    assert.equal(items[0].tt, 'a');
                                });
                                var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                    assert.equal(items[0].tt, 'a');
                                });
                                var p3 = prov.getOnly('test', 'ind1', 'abc').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                return SyncTasks.all([p1, p2, p3]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    function testBatchUpgrade(expectedCallCount, itemByteSize) {
                        var recordCount = 5000;
                        var data = {};
                        _.times(recordCount, function (num) {
                            data[num.toString()] = {
                                id: num.toString(),
                                tt: 'tt' + num.toString()
                            };
                        });
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    estimatedObjBytes: itemByteSize
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', _.values(data)).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            var transactionSpy;
                            if (provName.indexOf('sql') !== -1) {
                                // Check that we batch the upgrade by spying on number of queries indirectly
                                // This only affects sql-based tests
                                transactionSpy = sinon.spy(SqlProviderBase_1.SqlTransaction.prototype, 'internal_getResultsFromQuery');
                            }
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        estimatedObjBytes: itemByteSize,
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt'
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                if (transactionSpy) {
                                    assert.equal(transactionSpy.callCount, expectedCallCount, 'Incorrect transaction count');
                                    transactionSpy.restore();
                                }
                                return prov.getAll('test', undefined).then(function (records) {
                                    assert.equal(records.length, _.keys(data).length, 'Incorrect record count');
                                    _.each(records, function (dbRecordToValidate) {
                                        var originalRecord = data[dbRecordToValidate.id];
                                        assert.ok(!!originalRecord);
                                        assert.equal(originalRecord.id, dbRecordToValidate.id);
                                        assert.equal(originalRecord.tt, dbRecordToValidate.tt);
                                    });
                                }).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    }
                    it('Add index - Large records - batched upgrade', function () {
                        return testBatchUpgrade(51, 10000);
                    });
                    it('Add index - small records - No batch upgrade', function () {
                        return testBatchUpgrade(1, 1);
                    });
                    if (provName.indexOf('indexeddb') !== 0) {
                        // This migration works on indexeddb because we don't check the types and the browsers silently accept it but just
                        // neglect to index the field...
                        it('Add index to boolean field should fail', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, true).then(function (prov) {
                                return prov.put('test', { id: 'abc', tt: true }).then(function () {
                                    return prov.close();
                                });
                            }).then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [{
                                                    name: 'ind1',
                                                    keyPath: 'tt'
                                                }]
                                        }
                                    ]
                                }, false).then(function () {
                                    return SyncTasks.Rejected('Should not work');
                                }, function (err) {
                                    return SyncTasks.Resolved();
                                });
                            });
                        });
                    }
                    it('Add multiEntry index', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: ['a', 'b'] }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                multiEntry: true
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p1b = prov.getOnly('test', 'ind1', 'b').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p3 = prov.getOnly('test', 'ind1', 'abc').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                return SyncTasks.all([p1, p1b, p2, p3]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Changing multiEntry index', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [{
                                            name: 'ind1',
                                            keyPath: 'tt',
                                            multiEntry: true
                                        }]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: ['x', 'y'], ttb: ['a', 'b'] }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'ttb',
                                                multiEntry: true
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p1b = prov.getOnly('test', 'ind1', 'b').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p1c = prov.getOnly('test', 'ind1', 'x').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p3 = prov.getOnly('test', 'ind1', 'abc').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                return SyncTasks.all([p1, p1b, p1c, p2, p3]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Removing old index', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [{
                                            name: 'ind1',
                                            keyPath: 'tt'
                                        }]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: 'a' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, false).then(function (prov) {
                                return prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    return prov.close().then(function () {
                                        return SyncTasks.Rejected('Shouldn\'t have worked');
                                    });
                                }, function () {
                                    // Expected to fail, so chain from failure to success
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Changing index keypath', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [{
                                            name: 'ind1',
                                            keyPath: 'tt'
                                        }]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: 'a', ttb: 'b' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'ttb'
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                var p2 = prov.getOnly('test', 'ind1', 'b').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].ttb, 'b');
                                });
                                var p3 = prov.getOnly('test', 'ind1', 'abc').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                return SyncTasks.all([p1, p2, p3]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Change non-multientry index to includeDataInIndex', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [{
                                            name: 'ind1',
                                            keyPath: 'tt'
                                        }]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: 'a' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                includeDataInIndex: true
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                    assert.equal(items[0].tt, 'a');
                                });
                                var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                    assert.equal(items[0].tt, 'a');
                                });
                                var p3 = prov.getOnly('test', 'ind1', 'abc').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                return SyncTasks.all([p1, p2, p3]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Change non-multientry index from includeDataInIndex', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [{
                                            name: 'ind1',
                                            keyPath: 'tt',
                                            includeDataInIndex: true
                                        }]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: 'a' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                includeDataInIndex: false
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                    assert.equal(items[0].tt, 'a');
                                });
                                var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                    assert.equal(items[0].tt, 'a');
                                });
                                var p3 = prov.getOnly('test', 'ind1', 'abc').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                return SyncTasks.all([p1, p2, p3]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Change multientry index to includeDataInIndex', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [{
                                            name: 'ind1',
                                            keyPath: 'tt',
                                            multiEntry: true
                                        }]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: ['a', 'b'] }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                multiEntry: true,
                                                includeDataInIndex: true
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p1b = prov.getOnly('test', 'ind1', 'b').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p3 = prov.getOnly('test', 'ind1', 'abc').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                return SyncTasks.all([p1, p1b, p2, p3]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Change multientry index from includeDataInIndex', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [{
                                            name: 'ind1',
                                            keyPath: 'tt',
                                            multiEntry: true,
                                            includeDataInIndex: true
                                        }]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', tt: ['a', 'b'] }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                multiEntry: true,
                                                includeDataInIndex: false
                                            }]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p1b = prov.getOnly('test', 'ind1', 'b').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                var p3 = prov.getOnly('test', 'ind1', 'abc').then(function (items) {
                                    assert.equal(items.length, 0);
                                });
                                return SyncTasks.all([p1, p1b, p2, p3]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Adding new FTS store', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    },
                                    {
                                        name: 'test2',
                                        primaryKeyPath: 'id',
                                        indexes: [
                                            {
                                                name: 'a',
                                                keyPath: 'content',
                                                fullText: true
                                            }
                                        ]
                                    }
                                ]
                            }, false).then(function (prov) {
                                return prov.put('test2', { id: 'def', content: 'ghi' }).then(function () {
                                    var p1 = prov.get('test', 'abc').then(function (item) {
                                        assert.ok(item);
                                        assert.equal(item.id, 'abc');
                                    });
                                    var p2 = prov.get('test2', 'abc').then(function (item) {
                                        assert.ok(!item);
                                    });
                                    var p3 = prov.get('test2', 'def').then(function (item) {
                                        assert.ok(item);
                                    });
                                    var p4 = prov.fullTextSearch('test2', 'a', 'ghi').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'def');
                                    });
                                    return SyncTasks.all([p1, p2, p3, p4]).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                    });
                    it('Adding new FTS index', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id'
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', content: 'ghi' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [
                                            {
                                                name: 'a',
                                                keyPath: 'content',
                                                fullText: true
                                            }
                                        ]
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.get('test', 'abc').then(function (item) {
                                    assert.ok(item);
                                    assert.equal(item.id, 'abc');
                                });
                                var p2 = prov.fullTextSearch('test', 'a', 'ghi').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                });
                                return SyncTasks.all([p1, p2]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    it('Removing FTS index', function () {
                        return openProvider(provName, {
                            version: 1,
                            stores: [
                                {
                                    name: 'test',
                                    primaryKeyPath: 'id',
                                    indexes: [
                                        {
                                            name: 'a',
                                            keyPath: 'content',
                                            fullText: true
                                        }
                                    ]
                                }
                            ]
                        }, true).then(function (prov) {
                            return prov.put('test', { id: 'abc', content: 'ghi' }).then(function () {
                                return prov.close();
                            });
                        }).then(function () {
                            return openProvider(provName, {
                                version: 2,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, false).then(function (prov) {
                                var p1 = prov.get('test', 'abc').then(function (item) {
                                    assert.ok(item);
                                    assert.equal(item.id, 'abc');
                                    assert.equal(item.content, 'ghi');
                                });
                                var p2 = prov.fullTextSearch('test', 'a', 'ghi').then(function (items) {
                                    assert.equal(items.length, 1);
                                    assert.equal(items[0].id, 'abc');
                                }).then(function () {
                                    assert.ok(false, 'should not work');
                                }, function (err) {
                                    return SyncTasks.Resolved();
                                });
                                return SyncTasks.all([p1, p2]).then(function () {
                                    return prov.close();
                                });
                            });
                        });
                    });
                    // indexed db might backfill anyway behind the scenes
                    if (provName.indexOf('indexeddb') !== 0) {
                        it('Adding an index that does not require backfill', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, true).then(function (prov) {
                                return prov.put('test', { id: 'abc', tt: 'a' }).then(function () {
                                    return prov.close();
                                });
                            }).then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [{
                                                    name: 'ind1',
                                                    keyPath: 'tt',
                                                    doNotBackfill: true
                                                }]
                                        }
                                    ]
                                }, false).then(function (prov) { return prov.put('test', { id: 'bcd', tt: 'b' }).then(function () {
                                    var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                        // item not found, we didn't backfill the first item
                                        assert.equal(items.length, 0);
                                    });
                                    var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                    });
                                    var p3 = prov.getOnly('test', 'ind1', 'b').then(function (items) {
                                        // index works properly for the new item
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'bcd');
                                        assert.equal(items[0].tt, 'b');
                                    });
                                    return SyncTasks.all([p1, p2, p3]).then(function () {
                                        return prov.close();
                                    });
                                }); });
                            });
                        });
                        it('Adding two indexes at once - backfill and not', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, true).then(function (prov) {
                                return prov.put('test', { id: 'abc', tt: 'a', zz: 'b' }).then(function () {
                                    return prov.close();
                                });
                            }).then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [
                                                {
                                                    name: 'ind1',
                                                    keyPath: 'tt',
                                                    doNotBackfill: true,
                                                },
                                                {
                                                    name: 'ind2',
                                                    keyPath: 'zz',
                                                }
                                            ]
                                        }
                                    ]
                                }, false).then(function (prov) {
                                    var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                        // we had to backfill, so we filled all 
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'b');
                                    });
                                    var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'b');
                                    });
                                    var p3 = prov.getOnly('test', 'ind2', 'b').then(function (items) {
                                        // index works properly for the second index
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'b');
                                    });
                                    return SyncTasks.all([p1, p2, p3]).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                        it('Change no backfill index into a normal index', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [
                                            {
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                doNotBackfill: true,
                                            },
                                        ]
                                    }
                                ]
                            }, true).then(function (prov) {
                                return prov.put('test', { id: 'abc', tt: 'a', zz: 'b' }).then(function () {
                                    return prov.close();
                                });
                            }).then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [
                                                {
                                                    name: 'ind1',
                                                    keyPath: 'tt',
                                                },
                                            ]
                                        }
                                    ]
                                }, false).then(function (prov) {
                                    var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                        // we backfilled 
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'b');
                                    });
                                    var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'b');
                                    });
                                    return SyncTasks.all([p1, p2]).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                        it('Perform two updates which require no backfill', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id'
                                    }
                                ]
                            }, true)
                                .then(function (prov) {
                                return prov.put('test', { id: 'abc', tt: 'a', zz: 'aa' }).then(function () {
                                    return prov.close();
                                });
                            })
                                .then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [{
                                                    name: 'ind1',
                                                    keyPath: 'tt',
                                                    doNotBackfill: true
                                                }]
                                        }
                                    ]
                                }, false)
                                    .then(function (prov) {
                                    return prov.put('test', { id: 'bcd', tt: 'b', zz: 'bb' }).then(function () {
                                        return prov.close();
                                    });
                                });
                            })
                                .then(function () {
                                return openProvider(provName, {
                                    version: 3,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [{
                                                    name: 'ind1',
                                                    keyPath: 'tt',
                                                    doNotBackfill: true
                                                }, {
                                                    name: 'ind2',
                                                    keyPath: 'zz',
                                                    doNotBackfill: true
                                                }]
                                        }
                                    ]
                                }, false)
                                    .then(function (prov) {
                                    var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                        // item not found, we didn't backfill the first item
                                        assert.equal(items.length, 0);
                                    });
                                    var p2 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'aa');
                                    });
                                    var p3 = prov.getOnly('test', 'ind1', 'b').then(function (items) {
                                        // first index works properly for the second item
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'bcd');
                                        assert.equal(items[0].tt, 'b');
                                    });
                                    var p4 = prov.getOnly('test', 'ind2', 'bb').then(function (items) {
                                        // second index wasn't backfilled
                                        assert.equal(items.length, 0);
                                    });
                                    return SyncTasks.all([p1, p2, p3, p4]).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                        it('Removes index without pulling data to JS', function () {
                            var storeSpy;
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [
                                            {
                                                name: 'ind1',
                                                keyPath: 'content',
                                            }
                                        ]
                                    }
                                ]
                            }, true).then(function (prov) {
                                return prov.put('test', { id: 'abc', content: 'ghi' }).then(function () {
                                    return prov.close();
                                });
                            }).then(function () {
                                storeSpy = sinon.spy(SqlProviderBase_1.SqlTransaction.prototype, 'getStore');
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id'
                                        }
                                    ]
                                }, false)
                                    .then(function (prov) {
                                    // NOTE - the line below tests an implementation detail
                                    sinon.assert.notCalled(storeSpy);
                                    // check the index was actually removed
                                    var p1 = prov.get('test', 'abc').then(function (item) {
                                        assert.ok(item);
                                        assert.equal(item.id, 'abc');
                                        assert.equal(item.content, 'ghi');
                                    });
                                    var p2 = prov.getOnly('test', 'ind1', 'ghi').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                    }).then(function () {
                                        assert.ok(false, 'should not work');
                                    }, function (err) {
                                        return SyncTasks.Resolved();
                                    });
                                    return SyncTasks.all([p1, p2]).then(function () {
                                        return prov.close();
                                    });
                                });
                            }).finally(function () {
                                if (storeSpy) {
                                    storeSpy.restore();
                                }
                            });
                        });
                        it('Cleans up stale indices from metadata', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [
                                            {
                                                name: 'ind1',
                                                keyPath: 'content',
                                            },
                                            {
                                                name: 'ind2',
                                                keyPath: 'content',
                                            }
                                        ]
                                    }
                                ]
                            }, true)
                                .then(function (prov) { return prov.close(); })
                                .then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id'
                                        }
                                    ]
                                }, false)
                                    .then(function (prov) {
                                    return prov.openTransaction(undefined, false).then(function (trans) {
                                        return trans.runQuery('SELECT name, value from metadata').then(function (fullMeta) {
                                            _.each(fullMeta, function (meta) {
                                                var metaObj = JSON.parse(meta.value);
                                                if (metaObj.storeName === 'test' && !!metaObj.index && metaObj.index.name === 'ind1') {
                                                    assert.fail('Removed index should not exist in the meta!');
                                                }
                                            });
                                        });
                                    }).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                        it('Add and remove index in the same upgrade', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                doNotBackfill: true
                                            }]
                                    }
                                ]
                            }, true)
                                .then(function (prov) {
                                return prov.put('test', { id: 'abc', tt: 'a', zz: 'aa' }).then(function () {
                                    return prov.close();
                                });
                            })
                                .then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [{
                                                    name: 'ind2',
                                                    keyPath: 'zz',
                                                    doNotBackfill: true
                                                }]
                                        }
                                    ]
                                }, false)
                                    .then(function (prov) {
                                    var p1 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'aa');
                                    });
                                    var p2 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                        return SyncTasks.Rejected('Shouldn\'t have worked');
                                    }, function () {
                                        // Expected to fail, so chain from failure to success
                                        return undefined;
                                    });
                                    return SyncTasks.all([p1, p2]).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                        it('Recreates missing indices', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                doNotBackfill: true
                                            }]
                                    }
                                ]
                            }, true)
                                .then(function (prov) {
                                return prov.put('test', { id: 'abc', tt: 'a', zz: 'aa' })
                                    .then(function () {
                                    return prov.openTransaction(['test'], true).then(function (trans) {
                                        // simulate broken index
                                        return trans.runQuery('DROP INDEX test_ind1');
                                    });
                                })
                                    .then(function () {
                                    return prov.close();
                                });
                            })
                                .then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [{
                                                    name: 'ind1',
                                                    keyPath: 'tt',
                                                    doNotBackfill: true
                                                }]
                                        }
                                    ]
                                }, false)
                                    .then(function (prov) {
                                    var p1 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'aa');
                                    });
                                    var p2 = prov.openTransaction(undefined, false).then(function (trans) {
                                        return trans.runQuery('SELECT type, name, tbl_name, sql from sqlite_master')
                                            .then(function (fullMeta) {
                                            var oldIndexReallyExists = _.some(fullMeta, function (metaObj) {
                                                if (metaObj.type === 'index' && metaObj.tbl_name === 'test'
                                                    && metaObj.name === 'test_ind1') {
                                                    return true;
                                                }
                                                return false;
                                            });
                                            if (!oldIndexReallyExists) {
                                                return SyncTasks.Rejected('Unchanged index should still exist!');
                                            }
                                            return SyncTasks.Resolved(undefined);
                                        });
                                    });
                                    return SyncTasks.all([p1, p2]).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                        it('Add remove index in the same upgrade, while preserving other indices', function () {
                            return openProvider(provName, {
                                version: 1,
                                stores: [
                                    {
                                        name: 'test',
                                        primaryKeyPath: 'id',
                                        indexes: [{
                                                name: 'ind1',
                                                keyPath: 'tt',
                                                doNotBackfill: true
                                            }, {
                                                name: 'ind2',
                                                keyPath: 'zz',
                                                doNotBackfill: true
                                            }]
                                    }
                                ]
                            }, true)
                                .then(function (prov) {
                                return prov.put('test', { id: 'abc', tt: 'a', zz: 'aa' }).then(function () {
                                    return prov.close();
                                });
                            })
                                .then(function () {
                                return openProvider(provName, {
                                    version: 2,
                                    stores: [
                                        {
                                            name: 'test',
                                            primaryKeyPath: 'id',
                                            indexes: [{
                                                    name: 'ind2',
                                                    keyPath: 'zz',
                                                    doNotBackfill: true
                                                }, {
                                                    name: 'ind3',
                                                    keyPath: 'zz',
                                                    doNotBackfill: true
                                                }]
                                        }
                                    ]
                                }, false)
                                    .then(function (prov) {
                                    var p1 = prov.getOnly('test', undefined, 'abc').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'aa');
                                    });
                                    var p2 = prov.getOnly('test', 'ind2', 'aa').then(function (items) {
                                        assert.equal(items.length, 1);
                                        assert.equal(items[0].id, 'abc');
                                        assert.equal(items[0].tt, 'a');
                                        assert.equal(items[0].zz, 'aa');
                                    });
                                    var p3 = prov.getOnly('test', 'ind1', 'a').then(function (items) {
                                        return SyncTasks.Rejected('Shouldn\'t have worked');
                                    }, function () {
                                        // Expected to fail, so chain from failure to success
                                        return undefined;
                                    });
                                    var p4 = prov.openTransaction(undefined, false).then(function (trans) {
                                        return trans.runQuery('SELECT type, name, tbl_name, sql from sqlite_master')
                                            .then(function (fullMeta) {
                                            var oldIndexReallyExists = _.some(fullMeta, function (metaObj) {
                                                if (metaObj.type === 'index' && metaObj.tbl_name === 'test'
                                                    && metaObj.name === 'test_ind2') {
                                                    return true;
                                                }
                                                return false;
                                            });
                                            if (!oldIndexReallyExists) {
                                                return SyncTasks.Rejected('Unchanged index should still exist!');
                                            }
                                            return SyncTasks.Resolved(undefined);
                                        });
                                    });
                                    return SyncTasks.all([p1, p2, p3, p4]).then(function () {
                                        return prov.close();
                                    });
                                });
                            });
                        });
                    }
                });
            }
            it('Full Text Index', function () {
                return openProvider(provName, {
                    version: 1,
                    stores: [
                        {
                            name: 'test',
                            primaryKeyPath: 'id',
                            indexes: [{
                                    name: 'i',
                                    keyPath: 'txt',
                                    fullText: true
                                }]
                        }
                    ]
                }, true).then(function (prov) {
                    return prov.put('test', [
                        { id: 'a1', txt: 'the quick brown fox jumps over the lăzy dog who is a bro with brows' },
                        { id: 'a2', txt: 'bob likes his dog' },
                        { id: 'a3', txt: 'tes>ter' },
                        {
                            id: 'a4',
                            txt: 'Бывает проснешься как птица,' +
                                ' крылатой пружиной на взводе и хочется жить и трудиться, но к завтраку это проходит!'
                        },
                        {
                            id: 'a5',
                            txt: '漁夫從遠處看見漁夫'
                        },
                        {
                            // i18n digits test case
                            id: 'a6',
                            txt: '߂i18nDigits߂'
                        },
                        {
                            // Test data to make sure that we don't search for empty strings (... used to put empty string to the index)
                            id: 'a7',
                            txt: 'User1, User2, User3 ...'
                        }
                    ]).then(function () {
                        var p1 = prov.fullTextSearch('test', 'i', 'brown').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p2 = prov.fullTextSearch('test', 'i', 'dog').then(function (res) {
                            assert.equal(res.length, 2);
                        });
                        var p3 = prov.fullTextSearch('test', 'i', 'do').then(function (res) {
                            assert.equal(res.length, 2);
                        });
                        var p4 = prov.fullTextSearch('test', 'i', 'LiKe').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a2');
                        });
                        var p5 = prov.fullTextSearch('test', 'i', 'azy').then(function (res) {
                            assert.equal(res.length, 0);
                        });
                        var p6 = prov.fullTextSearch('test', 'i', 'lazy dog').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p7 = prov.fullTextSearch('test', 'i', 'dog lazy').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p8 = prov.fullTextSearch('test', 'i', 'DOG lăzy').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p9 = prov.fullTextSearch('test', 'i', 'lĄzy').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p10 = prov.fullTextSearch('test', 'i', 'brown brown brown').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p11 = prov.fullTextSearch('test', 'i', 'brown brOwn browN').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p12 = prov.fullTextSearch('test', 'i', 'brow').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p13 = prov.fullTextSearch('test', 'i', 'bro').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p14 = prov.fullTextSearch('test', 'i', 'br').then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p15 = prov.fullTextSearch('test', 'i', 'b').then(function (res) {
                            assert.equal(res.length, 2);
                        });
                        var p16 = prov.fullTextSearch('test', 'i', 'b z').then(function (res) {
                            assert.equal(res.length, 0);
                        });
                        var p17 = prov.fullTextSearch('test', 'i', 'b z', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 2);
                            assert.ok(_.some(res, function (r) { return r.id === 'a1'; }) && _.some(res, function (r) { return r.id === 'a2'; }));
                        });
                        var p18 = prov.fullTextSearch('test', 'i', 'q h', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 2);
                            assert.ok(_.some(res, function (r) { return r.id === 'a1'; }) && _.some(res, function (r) { return r.id === 'a2'; }));
                        });
                        var p19 = prov.fullTextSearch('test', 'i', 'fox nopers', NoSqlProvider.FullTextTermResolution.Or)
                            .then(function (res) {
                            assert.equal(res.length, 1);
                            assert.equal(res[0].id, 'a1');
                        });
                        var p20 = prov.fullTextSearch('test', 'i', 'foxers nopers', NoSqlProvider.FullTextTermResolution.Or)
                            .then(function (res) {
                            assert.equal(res.length, 0);
                        });
                        var p21 = prov.fullTextSearch('test', 'i', 'fox)', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 1);
                        });
                        var p22 = prov.fullTextSearch('test', 'i', 'fox*', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 1);
                        });
                        var p23 = prov.fullTextSearch('test', 'i', 'fox* fox( <fox>', NoSqlProvider.FullTextTermResolution.Or)
                            .then(function (res) {
                            assert.equal(res.length, 1);
                        });
                        var p24 = prov.fullTextSearch('test', 'i', 'f)ox', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 0);
                        });
                        var p25 = prov.fullTextSearch('test', 'i', 'fo*x', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 0);
                        });
                        var p26 = prov.fullTextSearch('test', 'i', 'tes>ter', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 1);
                        });
                        var p27 = prov.fullTextSearch('test', 'i', 'f*x', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 0);
                        });
                        var p28 = prov.fullTextSearch('test', 'i', 'бывает', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 1);
                        });
                        var p29 = prov.fullTextSearch('test', 'i', '漁', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 1);
                        });
                        var p30 = prov.fullTextSearch('test', 'i', '߂i18nDigits߂', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 1);
                        });
                        // This is an empty string test. All special symbols will be replaced so this is technically empty string search.
                        var p31 = prov.fullTextSearch('test', 'i', '!@#$%$', NoSqlProvider.FullTextTermResolution.Or).then(function (res) {
                            assert.equal(res.length, 0);
                        });
                        return SyncTasks.all([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20,
                            p21, p22, p23, p24, p25, p26, p27, p28, p29, p30, p31]).then(function () {
                            return prov.close();
                        });
                    });
                });
            });
        });
    });
});
//# sourceMappingURL=NoSqlProviderTests.js.map