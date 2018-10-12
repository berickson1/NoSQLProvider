"use strict";
/**
* FullTextSearchHelpers.ts
* Author: David de Regt
* Copyright: Microsoft 2017
*
* Reusable helper classes and functions for supporting Full Text Search.
*/
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var regexp_i18n_1 = require("regexp-i18n");
var SyncTasks = require("synctasks");
var NoSqlProvider = require("./NoSqlProvider");
var NoSqlProviderUtils = require("./NoSqlProviderUtils");
var _whitespaceRegexMatch = /\S+/g;
// Range which excludes all numbers and digits
var stripSpecialRange = regexp_i18n_1.Ranges.LETTERS_DIGITS_AND_DIACRITICS.invert();
function sqlCompat(value) {
    return regexp_i18n_1.trim(value, stripSpecialRange);
}
function breakAndNormalizeSearchPhrase(phrase) {
    // Deburr and tolower before using _.words since _.words breaks on CaseChanges.
    var words = _.words(_.deburr(phrase).toLowerCase(), _whitespaceRegexMatch);
    // _.map(_.mapKeys is faster than _.uniq since it's just a pile of strings.
    var uniqueWordas = _.map(_.mapKeys(words), function (value, key) { return sqlCompat(key); });
    return _.filter(uniqueWordas, function (word) { return !!_.trim(word); });
}
exports.breakAndNormalizeSearchPhrase = breakAndNormalizeSearchPhrase;
function getFullTextIndexWordsForItem(keyPath, item) {
    var rawString = NoSqlProviderUtils.getValueForSingleKeypath(item, keyPath);
    return breakAndNormalizeSearchPhrase(rawString);
}
exports.getFullTextIndexWordsForItem = getFullTextIndexWordsForItem;
var DbIndexFTSFromRangeQueries = /** @class */ (function () {
    function DbIndexFTSFromRangeQueries(_indexSchema, _primaryKeyPath) {
        this._indexSchema = _indexSchema;
        this._primaryKeyPath = _primaryKeyPath;
        this._keyPath = this._indexSchema ? this._indexSchema.keyPath : this._primaryKeyPath;
    }
    DbIndexFTSFromRangeQueries.prototype.fullTextSearch = function (searchPhrase, resolution, limit) {
        var _this = this;
        if (resolution === void 0) { resolution = NoSqlProvider.FullTextTermResolution.And; }
        if (!this._indexSchema || !this._indexSchema.fullText) {
            return SyncTasks.Rejected('fullTextSearch performed against non-fullText index!');
        }
        var terms = breakAndNormalizeSearchPhrase(searchPhrase);
        if (terms.length === 0) {
            return SyncTasks.Resolved([]);
        }
        var promises = _.map(terms, function (term) {
            var upperEnd = term.substr(0, term.length - 1) + String.fromCharCode(term.charCodeAt(term.length - 1) + 1);
            return _this.getRange(term, upperEnd, false, true, false, limit);
        });
        return SyncTasks.all(promises).then(function (results) {
            var uniquers = _.attempt(function () {
                return _.map(results, function (resultSet) { return _.keyBy(resultSet, function (item) {
                    return NoSqlProviderUtils.getSerializedKeyForKeypath(item, _this._primaryKeyPath);
                }); });
            });
            if (_.isError(uniquers)) {
                return SyncTasks.Rejected(uniquers);
            }
            if (resolution === NoSqlProvider.FullTextTermResolution.Or) {
                var data = _.values(_.assign.apply(_, [{}].concat(uniquers)));
                if (limit) {
                    return _.take(data, limit);
                }
                return data;
            }
            if (resolution === NoSqlProvider.FullTextTermResolution.And) {
                var first = uniquers[0], others_1 = uniquers.slice(1);
                var dic = _.pickBy(first, function (value, key) { return _.every(others_1, function (set) { return key in set; }); });
                var data = _.values(dic);
                if (limit) {
                    return _.take(data, limit);
                }
                return data;
            }
            return SyncTasks.Rejected('Undefined full text term resolution type');
        });
    };
    return DbIndexFTSFromRangeQueries;
}());
exports.DbIndexFTSFromRangeQueries = DbIndexFTSFromRangeQueries;
//# sourceMappingURL=FullTextSearchHelpers.js.map