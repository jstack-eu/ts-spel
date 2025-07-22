"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSafeEvaluator = exports.getEvaluator = exports.parse = void 0;
var Evaluate_1 = require("./lib/Evaluate");
Object.defineProperty(exports, "getEvaluator", { enumerable: true, get: function () { return Evaluate_1.getEvaluator; } });
var ParseToAst_1 = require("./lib/ParseToAst");
Object.defineProperty(exports, "parse", { enumerable: true, get: function () { return ParseToAst_1.parse; } });
// Convenience function for null-safe evaluation
var getSafeEvaluator = function (rootContext, functionsAndVariables, options) {
    return (0, Evaluate_1.getEvaluator)(rootContext, functionsAndVariables, __assign({ disableNullPointerExceptions: true }, options));
};
exports.getSafeEvaluator = getSafeEvaluator;
//# sourceMappingURL=index.js.map