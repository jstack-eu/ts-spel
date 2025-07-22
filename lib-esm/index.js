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
import { getEvaluator } from './lib/Evaluate';
import { parse } from './lib/ParseToAst';
export { parse, getEvaluator };
// Convenience function for null-safe evaluation
export var getSafeEvaluator = function (rootContext, functionsAndVariables, options) {
    return getEvaluator(rootContext, functionsAndVariables, __assign({ disableNullPointerExceptions: true }, options));
};
//# sourceMappingURL=index.js.map