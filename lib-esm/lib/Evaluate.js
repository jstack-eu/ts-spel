var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { UnexpectedError } from "./CustomErrors";
import JSOG from "jsog";
import { safeCompileRegex } from "./RegexValidator";
var stringify = function (obj) {
    try {
        //if value is date, return date string
        if (obj instanceof Date) {
            return obj.toISOString();
        }
        return JSON.stringify(obj);
    }
    catch (e) {
        if (e.message.startsWith("Converting circular structure to JSON")) {
            return JSON.stringify(JSON.parse(JSOG.stringify(obj)), null, 2);
        }
        throw e;
    }
};
var some = function (value) { return ({
    _tag: "some",
    isSome: true,
    value: value,
}); };
var none = {
    _tag: "none",
    isSome: false,
};
var isSome = function (maybe) {
    return maybe._tag === "some";
};
var isNone = function (maybe) {
    return maybe._tag === "none";
};
var maybeFromUndefined = function (value) {
    if (typeof value === "undefined") {
        return none;
    }
    return some(value);
};
export var getEvaluator = function (rootContext, functionsAndVariables, options) {
    var _a, _b, _c, _d;
    var disableBoolOpChecks = (_a = options === null || options === void 0 ? void 0 : options.disableBoolOpChecks) !== null && _a !== void 0 ? _a : false;
    var disableNullPointerExceptions = (_b = options === null || options === void 0 ? void 0 : options.disableNullPointerExceptions) !== null && _b !== void 0 ? _b : false;
    var fallbackToFunctions = (_c = options === null || options === void 0 ? void 0 : options.fallbackToFunctions) !== null && _c !== void 0 ? _c : false;
    var fallbackToVariables = (_d = options === null || options === void 0 ? void 0 : options.fallbackToVariables) !== null && _d !== void 0 ? _d : false;
    // Security features are always enabled and non-configurable
    var createDefaultWhitelist = require("./SecurityWhitelist").createDefaultWhitelist;
    var whitelist = createDefaultWhitelist();
    var defaultRegexValidator = require("./RegexValidator").defaultRegexValidator;
    var regexValidator = defaultRegexValidator;
    var stack = [rootContext]; // <- could be a class.
    var getHead = function () {
        if (stack.length > 0) {
            return stack[stack.length - 1];
        }
        throw new UnexpectedError("Stack is empty");
    };
    /**
     * see test for foo.identity(#this.a)
     * (we want the outer #this, not foo.a)
     * to do so, we need to keep track of #this, outside of our current head (onto which the property 'foo' has been pushed)
     */
    var ixOfThisBeforeCompoundOpened = (function () {
        var _ix = [];
        return {
            pushCurrent: function () { return _ix.push(stack.length - 1); },
            get: function () { var _a; return (_a = _ix[_ix.length - 1]) !== null && _a !== void 0 ? _a : null; },
            pop: function () { return _ix.pop(); },
            hasSome: function () { return _ix.length > 0; },
        };
    })();
    var getValueInProvidedFuncsAndVars = function (variableName) {
        if (variableName === "this") {
            return some(getHead());
        }
        else if (variableName === "root") {
            return some(stack[0]);
        }
        else {
            if (Array.isArray(functionsAndVariables)) {
                for (var i = 0; i < functionsAndVariables.length; i++) {
                    if (Object.prototype.hasOwnProperty.call(functionsAndVariables[i], variableName)) {
                        var res = functionsAndVariables[i][variableName];
                        if (typeof res !== "undefined") {
                            return some(res);
                        }
                    }
                }
                return none;
            }
            // Use safe property access
            if (Object.prototype.hasOwnProperty.call(functionsAndVariables, variableName)) {
                return maybeFromUndefined(functionsAndVariables[variableName]);
            }
            return none;
        }
    };
    var searchForPropertyValueInContextStack = function (variable) {
        return __spreadArray([], stack, true).reverse().reduce(function (prev, curr) {
            if (isSome(prev)) {
                return prev;
            }
            else if (variable === "this") {
                return some(curr);
            }
            else if (curr !== null && typeof curr !== "undefined") {
                // Use safe property access to prevent prototype pollution
                if (Object.prototype.hasOwnProperty.call(curr, variable)) {
                    return maybeFromUndefined(curr[variable]);
                }
                return none;
            }
            else {
                return none;
            }
        }, none);
    };
    function binFloatOp(op, allowNull) {
        if (allowNull === void 0) { allowNull = false; }
        return function (left, right) {
            // Convert Date objects to timestamps
            var convertToNumber = function (val) {
                if (val instanceof Date) {
                    return val.getTime();
                }
                return val;
            };
            var leftConverted = convertToNumber(left);
            var rightConverted = convertToNumber(right);
            if (typeof leftConverted !== "number" &&
                !(allowNull && (leftConverted === null || typeof leftConverted === "undefined"))) {
                throw new Error(stringify(left) + " is not a float");
            }
            if (typeof rightConverted !== "number" &&
                !(allowNull && (rightConverted === null || typeof rightConverted === "undefined"))) {
                throw new Error(stringify(right) + " is not a float");
            }
            return op((leftConverted !== null && leftConverted !== void 0 ? leftConverted : null), (rightConverted !== null && rightConverted !== void 0 ? rightConverted : null));
        };
    }
    var binStringOp = function (op) {
        return function (left, right) {
            // Allow strings, numbers, and safe objects for comparison operations
            var isValidType = function (val) {
                return typeof val === "string" || typeof val === "number" ||
                    (val && typeof val === "object" && val.constructor === Object);
            };
            if (!isValidType(left)) {
                throw new Error(stringify(left) + " is not a valid type for string operation");
            }
            if (!isValidType(right)) {
                throw new Error(stringify(right) + " is not a valid type for string operation");
            }
            return op(left, right);
        };
    };
    var find = function (array, expression, reverse) {
        var value = reverse ? array.reverse() : array;
        var result = value.find(function (e) {
            stack.push(e);
            var result = evaluate(expression);
            stack.pop();
            if (disableBoolOpChecks) {
                return Boolean(result);
            }
            if (typeof result !== "boolean") {
                throw new Error("Result of selection expression is not Boolean");
            }
            return result === true;
        });
        return typeof result === "undefined" ? null : result;
    };
    var evaluate = function (ast, isCompound, isFirstInCompound) {
        var _a, _b;
        var _c, _d;
        if (isCompound === void 0) { isCompound = false; }
        if (isFirstInCompound === void 0) { isFirstInCompound = false; }
        switch (ast.type) {
            case "BooleanLiteral":
                return ast.value;
            case "CompoundExpression": {
                // Check if this compound expression exceeds property chain depth
                var propertyReferenceCount = ast.expressionComponents.filter(function (component) { return component.type === "PropertyReference"; }).length;
                if (propertyReferenceCount > 10) { // Default max depth
                    throw new Error("Security violation: Maximum property chain depth exceeded: ".concat(propertyReferenceCount, " (max: 10)"));
                }
                ixOfThisBeforeCompoundOpened.pushCurrent();
                var res = ast.expressionComponents.reduce(function (_, curr, i) {
                    var isFirst = i === 0;
                    var res = evaluate(curr, true, isFirst);
                    stack.push(res);
                    return res;
                }, rootContext);
                ast.expressionComponents.forEach(function () {
                    stack.pop();
                });
                ixOfThisBeforeCompoundOpened.pop();
                return res;
            }
            case "Elvis": {
                var expr = evaluate(ast.expression);
                if (expr === null) {
                    return evaluate(ast.ifFalse);
                }
                else {
                    return expr;
                }
            }
            case "FunctionReference": {
                // Handle T(java.lang.Math) static calls
                if (ast.functionName === "T" && ast.args.length === 1) {
                    var staticClass = null;
                    var arg = ast.args[0];
                    // Handle different argument types
                    if (arg.type === "StringLiteral") {
                        // T('java.lang.Math') - string literal
                        staticClass = arg.value;
                    }
                    else if (arg.type === "CompoundExpression") {
                        // T(java.lang.Math) - compound expression of property references
                        // Reconstruct the class name from property references
                        var parts = [];
                        for (var _i = 0, _e = arg.expressionComponents; _i < _e.length; _i++) {
                            var component = _e[_i];
                            if (component.type === "PropertyReference") {
                                parts.push(component.propertyName);
                            }
                            else {
                                // If it's not all property references, fall back to evaluation
                                staticClass = evaluate(arg);
                                break;
                            }
                        }
                        if (parts.length > 0 && staticClass === null) {
                            staticClass = parts.join('.');
                        }
                    }
                    else {
                        // For other types, evaluate normally
                        staticClass = evaluate(arg);
                    }
                    if (staticClass === "java.lang.Math") {
                        whitelist.enterCall();
                        // Return a Math proxy object that allows method calls
                        var mathProxy = {
                            min: function () {
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                return Math.min.apply(Math, args);
                            },
                            max: function () {
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                return Math.max.apply(Math, args);
                            },
                            abs: function (value) { return Math.abs(value); },
                            round: function (value) { return Math.round(value); },
                            floor: function (value) { return Math.floor(value); },
                            ceil: function (value) { return Math.ceil(value); },
                            sqrt: function (value) { return Math.sqrt(value); },
                            pow: function (base, exponent) { return Math.pow(base, exponent); },
                            // Mark this as a trusted Math proxy
                            __isMathProxy: true
                        };
                        whitelist.exitCall();
                        return mathProxy;
                    }
                    if (staticClass === "eu.jstack.jflow.core.operators.FlowUtils") {
                        whitelist.enterCall();
                        // Return a FlowUtils proxy object that allows method calls
                        var flowUtilsProxy = {
                            date: function (dateInput) {
                                // Handle both string and Date object inputs
                                if (typeof dateInput === 'string') {
                                    var date = new Date(dateInput);
                                    if (isNaN(date.getTime())) {
                                        throw new Error("FlowUtils.date() received invalid date string: ".concat(dateInput));
                                    }
                                    return date;
                                }
                                else if (dateInput instanceof Date) {
                                    return dateInput;
                                }
                                else if (dateInput && typeof dateInput === 'object') {
                                    // Try to convert object to date if it has date-like properties
                                    var dateStr = dateInput.toString();
                                    var date = new Date(dateStr);
                                    if (!isNaN(date.getTime())) {
                                        return date;
                                    }
                                    throw new Error("FlowUtils.date() received invalid date object: ".concat(dateStr));
                                }
                                else {
                                    throw new Error("FlowUtils.date() requires a string or Date argument, got ".concat(typeof dateInput));
                                }
                            },
                            // Mark this as a trusted FlowUtils proxy
                            __isFlowUtilsProxy: true
                        };
                        whitelist.exitCall();
                        return flowUtilsProxy;
                    }
                }
                // Check whitelist before allowing function call
                try {
                    whitelist.validateFunctionCall(ast.functionName);
                    whitelist.enterCall();
                }
                catch (error) {
                    throw new Error("Security violation: ".concat(error.message));
                }
                var maybeProvidedFunction = getValueInProvidedFuncsAndVars(ast.functionName);
                var evaluatedArguments = ast.args.map(function (arg) { return evaluate(arg); });
                if (isNone(maybeProvidedFunction)) {
                    whitelist.exitCall();
                    if (!ast.nullSafeNavigation) {
                        throw new Error("Function " + ast.functionName + " not found.");
                    }
                    else {
                        return null;
                    }
                }
                var value = maybeProvidedFunction.value;
                if (typeof value !== "function") {
                    whitelist.exitCall();
                    throw new Error("Variable " + ast.functionName + " is not a function.");
                }
                try {
                    var result = value.apply(void 0, evaluatedArguments);
                    whitelist.exitCall();
                    return result;
                }
                catch (error) {
                    whitelist.exitCall();
                    throw error;
                }
            }
            case "Indexer": {
                var head = getHead();
                if (head === null && ast.nullSafeNavigation) {
                    return null;
                }
                var index = ixOfThisBeforeCompoundOpened.hasSome()
                    ? (function () {
                        /**
                         * when a property is used in an index, it's looking backwards through the stack we built up _for the compound_, not the stack _outside the current compound_
                         * To do this properly, we need to track the stack _outside the current compound (of which [ ] is a part in the chain).
                         * This index, which tracks the stack _outside_ the current compound, is 'ixOfThisBeforeCompoundOpened'
                         *
                         */
                        // store the old stack, so we can put it back
                        var storedStack = stack;
                        // Now set a stack so #this points outside the head of our current compound expression
                        stack = stack.slice(0, ixOfThisBeforeCompoundOpened.get() + 1);
                        // evaluate with temporary stack
                        var result = evaluate(ast.index);
                        // put the stack back.
                        stack = storedStack;
                        return result;
                    })()
                    : evaluate(ast.index);
                // Check whitelist for string property access via indexer
                if (typeof index === "string") {
                    try {
                        whitelist.enterPropertyChain();
                        whitelist.validatePropertyAccess(index);
                        whitelist.validateObjectAccess(head);
                    }
                    catch (error) {
                        whitelist.exitPropertyChain();
                        throw new Error("Security violation: ".concat(error.message));
                    }
                }
                if (typeof head === "string" && typeof index === "number") {
                    if (index >= 0 && index < head.length) {
                        return head[index];
                    }
                    throw new Error("index " + index + " is out of range on string " + stringify(head));
                }
                else if (Array.isArray(head) && typeof index === "number") {
                    if (index >= 0 && index < head.length) {
                        return head[index];
                    }
                    throw new Error("index " + index + " is out of range on array " + stringify(head));
                }
                else if (head &&
                    typeof head === "object" &&
                    (typeof index === "string" || typeof index === "number")) {
                    if (Object.prototype.hasOwnProperty.call(head, index)) {
                        var result = head[index];
                        if (typeof index === "string") {
                            whitelist.exitPropertyChain();
                        }
                        return result;
                    }
                    else {
                        if (typeof index === "string") {
                            whitelist.exitPropertyChain();
                        }
                        return null;
                    }
                }
                if (typeof index === "string") {
                    whitelist.exitPropertyChain();
                }
                throw new Error("Not supported: indexing into " +
                    stringify(head) +
                    " with " +
                    stringify(index));
            }
            case "InlineList": {
                return ast.elements.map(function (el) { return evaluate(el); });
            }
            case "InlineMap": {
                return Object.entries(ast.elements).reduce(function (prev, _a) {
                    var k = _a[0], v = _a[1];
                    prev[k] = evaluate(v);
                    return prev;
                }, {});
            }
            case "MethodReference": {
                // Check whitelist for method access
                var head = getHead();
                // Global math functions don't need context validation
                var globalMathFunctions = new Set(['MIN', 'MAX', 'ABS', 'ROUND', 'FLOOR', 'CEIL', 'DOUBLE', 'T']);
                // Check if this is a Math proxy object (from T(java.lang.Math))
                var isMathProxy = head && typeof head === 'object' && head.__isMathProxy;
                // Check if this is a FlowUtils proxy object (from T(eu.jstack.jflow.core.operators.FlowUtils))
                var isFlowUtilsProxy = head && typeof head === 'object' && head.__isFlowUtilsProxy;
                if (!globalMathFunctions.has(ast.methodName) && !isMathProxy && !isFlowUtilsProxy) {
                    try {
                        whitelist.validateMethodCall(head, ast.methodName);
                        whitelist.enterCall();
                    }
                    catch (error) {
                        throw new Error("Security violation: ".concat(error.message));
                    }
                }
                else {
                    // For global math functions, just enter call tracking
                    whitelist.enterCall();
                }
                var evaluateArg_1 = function (arg) {
                    if (
                    // no index of a currently opened compound expression has been found
                    !ixOfThisBeforeCompoundOpened.hasSome() ||
                        // it's just the method call (e.g. foo()) with nothing before it - the current head is actually what we want
                        // (this happens when a.![foo(curr)])
                        // - this check that we aren't in a currently opened compound chain prevents the head (a[0] for example) from being popped off.
                        !isCompound) {
                        return evaluate(arg);
                    }
                    // store the old stack, so we can put it back
                    var storedStack = stack;
                    // Now set a stack so #this points outside the head of our current compound expression
                    stack = stack.slice(0, ixOfThisBeforeCompoundOpened.get() + 1);
                    // evaluate with temporary stack
                    var result = evaluate(arg);
                    // put the stack back.
                    stack = storedStack;
                    return result;
                };
                if (ast.methodName === "length") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        whitelist.exitCall();
                        return currentContext.length;
                    }
                }
                // JavaScript string methods
                if (ast.methodName === "endsWith") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        var searchString = evaluateArg_1(ast.args[0]);
                        if (typeof searchString !== "string") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.endsWith()' with argument of type " +
                                typeof searchString);
                        }
                        var position = ast.args[1] ? evaluateArg_1(ast.args[1]) : undefined;
                        whitelist.exitCall();
                        return currentContext.endsWith(searchString, typeof position === "number" ? position : undefined);
                    }
                }
                if (ast.methodName === "startsWith") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        var searchString = evaluateArg_1(ast.args[0]);
                        if (typeof searchString !== "string") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.startsWith()' with argument of type " +
                                typeof searchString);
                        }
                        var position = ast.args[1] ? evaluateArg_1(ast.args[1]) : undefined;
                        whitelist.exitCall();
                        return currentContext.startsWith(searchString, typeof position === "number" ? position : undefined);
                    }
                }
                if (ast.methodName === "includes") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        var searchString = evaluateArg_1(ast.args[0]);
                        if (typeof searchString !== "string") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.includes()' with argument of type " +
                                typeof searchString);
                        }
                        var position = ast.args[1] ? evaluateArg_1(ast.args[1]) : undefined;
                        whitelist.exitCall();
                        return currentContext.includes(searchString, typeof position === "number" ? position : undefined);
                    }
                }
                if (ast.methodName === "indexOf") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        var searchString = evaluateArg_1(ast.args[0]);
                        if (typeof searchString !== "string") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.indexOf()' with argument of type " +
                                typeof searchString);
                        }
                        var position = ast.args[1] ? evaluateArg_1(ast.args[1]) : undefined;
                        whitelist.exitCall();
                        return currentContext.indexOf(searchString, typeof position === "number" ? position : undefined);
                    }
                }
                if (ast.methodName === "lastIndexOf") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        var searchString = evaluateArg_1(ast.args[0]);
                        if (typeof searchString !== "string") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.lastIndexOf()' with argument of type " +
                                typeof searchString);
                        }
                        var position = ast.args[1] ? evaluateArg_1(ast.args[1]) : undefined;
                        whitelist.exitCall();
                        return currentContext.lastIndexOf(searchString, typeof position === "number" ? position : undefined);
                    }
                }
                if (ast.methodName === "toLowerCase") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        whitelist.exitCall();
                        return currentContext.toLowerCase();
                    }
                }
                if (ast.methodName === "toUpperCase") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        whitelist.exitCall();
                        return currentContext.toUpperCase();
                    }
                }
                if (ast.methodName === "trim") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        whitelist.exitCall();
                        return currentContext.trim();
                    }
                }
                if (ast.methodName === "substring") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        var start = evaluateArg_1(ast.args[0]);
                        if (typeof start !== "number") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.substring()' with start argument of type " +
                                typeof start);
                        }
                        var end = ast.args[1] ? evaluateArg_1(ast.args[1]) : undefined;
                        if (end !== undefined && typeof end !== "number") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.substring()' with end argument of type " +
                                typeof end);
                        }
                        whitelist.exitCall();
                        return currentContext.substring(start, end);
                    }
                }
                if (ast.methodName === "substr") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        var start = evaluateArg_1(ast.args[0]);
                        if (typeof start !== "number") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.substr()' with start argument of type " +
                                typeof start);
                        }
                        var length = ast.args[1] ? evaluateArg_1(ast.args[1]) : undefined;
                        if (length !== undefined && typeof length !== "number") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.substr()' with length argument of type " +
                                typeof length);
                        }
                        whitelist.exitCall();
                        return currentContext.substr(start, length);
                    }
                }
                if (ast.methodName === "matches") {
                    var currentContext = getHead();
                    if (typeof currentContext === "string") {
                        var rx = evaluateArg_1(ast.args[0]);
                        if (typeof rx !== "string") {
                            whitelist.exitCall();
                            throw new Error("Cannot call 'string.matches()' with argument of type " +
                                typeof rx);
                        }
                        whitelist.exitCall();
                        // Use safe regex compilation with validation
                        try {
                            return safeCompileRegex(rx, regexValidator)(currentContext);
                        }
                        catch (error) {
                            throw new Error("Regex validation failed: ".concat(error.message));
                        }
                    }
                }
                if (ast.methodName === "size") {
                    var currentContext = getHead();
                    if (Array.isArray(currentContext)) {
                        whitelist.exitCall();
                        return currentContext.length;
                    }
                }
                if (ast.methodName === "isEmpty") {
                    var currentContext = getHead();
                    if (Array.isArray(currentContext)) {
                        whitelist.exitCall();
                        return currentContext.length === 0;
                    }
                }
                if (ast.methodName === "get") {
                    var currentContext = getHead();
                    var rx = evaluateArg_1(ast.args[0]);
                    // Validate property access for security
                    if (typeof rx === "string") {
                        try {
                            whitelist.validatePropertyAccess(rx);
                            whitelist.validateObjectAccess(currentContext);
                        }
                        catch (error) {
                            whitelist.exitCall();
                            throw new Error("Security violation in get(): ".concat(error.message));
                        }
                    }
                    whitelist.exitCall();
                    return currentContext === null || currentContext === void 0 ? void 0 : currentContext[rx];
                }
                if (ast.methodName === "add") {
                    var currentContext = getHead();
                    var rx = evaluateArg_1(ast.args[0]);
                    // Validate input to prevent prototype pollution
                    if (rx && typeof rx === "object") {
                        if (rx.constructor !== Object && rx.constructor !== Array) {
                            whitelist.exitCall();
                            throw new Error("Security violation: Cannot add unsafe object type");
                        }
                        // Check for dangerous properties
                        if (Object.prototype.hasOwnProperty.call(rx, '__proto__') ||
                            Object.prototype.hasOwnProperty.call(rx, 'constructor') ||
                            Object.prototype.hasOwnProperty.call(rx, 'prototype')) {
                            whitelist.exitCall();
                            throw new Error("Security violation: Cannot add object with dangerous properties");
                        }
                    }
                    whitelist.exitCall();
                    return __spreadArray(__spreadArray([], currentContext, true), [rx], false);
                }
                if (ast.methodName === "contains") {
                    var currentContext = getHead();
                    if (Array.isArray(currentContext)) {
                        var result = currentContext.includes(evaluateArg_1(ast.args[0]));
                        whitelist.exitCall();
                        return result;
                    }
                }
                // Global math functions that work without context
                if (ast.methodName === "MIN") {
                    var args = ast.args.map(function (arg) { return evaluateArg_1(arg); });
                    if (args.length === 0) {
                        whitelist.exitCall();
                        throw new Error("MIN function requires at least one argument");
                    }
                    // Validate all arguments are numbers
                    for (var _f = 0, args_1 = args; _f < args_1.length; _f++) {
                        var arg = args_1[_f];
                        if (typeof arg !== "number") {
                            whitelist.exitCall();
                            throw new Error("MIN function argument must be a number, got ".concat(typeof arg));
                        }
                    }
                    whitelist.exitCall();
                    return Math.min.apply(Math, args);
                }
                if (ast.methodName === "MAX") {
                    var args = ast.args.map(function (arg) { return evaluateArg_1(arg); });
                    if (args.length === 0) {
                        whitelist.exitCall();
                        throw new Error("MAX function requires at least one argument");
                    }
                    // Validate all arguments are numbers
                    for (var _g = 0, args_2 = args; _g < args_2.length; _g++) {
                        var arg = args_2[_g];
                        if (typeof arg !== "number") {
                            whitelist.exitCall();
                            throw new Error("MAX function argument must be a number, got ".concat(typeof arg));
                        }
                    }
                    whitelist.exitCall();
                    return Math.max.apply(Math, args);
                }
                if (ast.methodName === "ABS") {
                    var args = ast.args.map(function (arg) { return evaluateArg_1(arg); });
                    if (args.length !== 1) {
                        whitelist.exitCall();
                        throw new Error("ABS function requires exactly one argument");
                    }
                    if (typeof args[0] !== "number") {
                        whitelist.exitCall();
                        throw new Error("ABS function argument must be a number, got ".concat(typeof args[0]));
                    }
                    whitelist.exitCall();
                    return Math.abs(args[0]);
                }
                if (ast.methodName === "ROUND") {
                    var args = ast.args.map(function (arg) { return evaluateArg_1(arg); });
                    if (args.length < 1 || args.length > 2) {
                        whitelist.exitCall();
                        throw new Error("ROUND function requires 1 or 2 arguments (value, precision)");
                    }
                    if (typeof args[0] !== "number") {
                        whitelist.exitCall();
                        throw new Error("ROUND function value must be a number, got ".concat(typeof args[0]));
                    }
                    // Default precision is 0 (round to integer)
                    var precision = args.length === 2 ? args[1] : 0;
                    if (typeof precision !== "number" || !Number.isInteger(precision)) {
                        whitelist.exitCall();
                        throw new Error("ROUND function precision must be an integer, got ".concat(typeof precision));
                    }
                    whitelist.exitCall();
                    // Handle precision rounding
                    if (precision === 0) {
                        return Math.round(args[0]);
                    }
                    else {
                        var factor = Math.pow(10, precision);
                        return Math.round(args[0] * factor) / factor;
                    }
                }
                if (ast.methodName === "FLOOR") {
                    var args = ast.args.map(function (arg) { return evaluateArg_1(arg); });
                    if (args.length !== 1) {
                        whitelist.exitCall();
                        throw new Error("FLOOR function requires exactly one argument");
                    }
                    if (typeof args[0] !== "number") {
                        whitelist.exitCall();
                        throw new Error("FLOOR function argument must be a number, got ".concat(typeof args[0]));
                    }
                    whitelist.exitCall();
                    return Math.floor(args[0]);
                }
                if (ast.methodName === "CEIL") {
                    var args = ast.args.map(function (arg) { return evaluateArg_1(arg); });
                    if (args.length !== 1) {
                        whitelist.exitCall();
                        throw new Error("CEIL function requires exactly one argument");
                    }
                    if (typeof args[0] !== "number") {
                        whitelist.exitCall();
                        throw new Error("CEIL function argument must be a number, got ".concat(typeof args[0]));
                    }
                    whitelist.exitCall();
                    return Math.ceil(args[0]);
                }
                if (ast.methodName === "DOUBLE") {
                    var args = ast.args.map(function (arg) { return evaluateArg_1(arg); });
                    if (args.length !== 1) {
                        whitelist.exitCall();
                        throw new Error("DOUBLE function requires exactly one argument");
                    }
                    whitelist.exitCall();
                    return parseFloat(args[0]);
                }
                // T() static class access - handle as method
                if (ast.methodName === "T") {
                    if (ast.args.length !== 1) {
                        whitelist.exitCall();
                        throw new Error("T function requires exactly one argument (class name)");
                    }
                    var staticClass = null;
                    var arg = ast.args[0];
                    // Handle different argument types
                    if (arg.type === "StringLiteral") {
                        // T('java.lang.Math') - string literal
                        staticClass = arg.value;
                    }
                    else if (arg.type === "CompoundExpression") {
                        // T(java.lang.Math) - compound expression of property references
                        // Reconstruct the class name from property references
                        var parts = [];
                        for (var _h = 0, _j = arg.expressionComponents; _h < _j.length; _h++) {
                            var component = _j[_h];
                            if (component.type === "PropertyReference") {
                                parts.push(component.propertyName);
                            }
                            else {
                                // If it's not all property references, fall back to evaluation
                                staticClass = evaluateArg_1(arg);
                                break;
                            }
                        }
                        if (parts.length > 0 && staticClass === null) {
                            staticClass = parts.join('.');
                        }
                    }
                    else {
                        // For other types, evaluate normally
                        staticClass = evaluateArg_1(arg);
                    }
                    if (staticClass === "java.lang.Math") {
                        // Return a Math proxy object that allows method calls
                        var mathProxy = {
                            min: function () {
                                var mathArgs = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    mathArgs[_i] = arguments[_i];
                                }
                                return Math.min.apply(Math, mathArgs);
                            },
                            max: function () {
                                var mathArgs = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    mathArgs[_i] = arguments[_i];
                                }
                                return Math.max.apply(Math, mathArgs);
                            },
                            abs: function (value) { return Math.abs(value); },
                            round: function (value) { return Math.round(value); },
                            floor: function (value) { return Math.floor(value); },
                            ceil: function (value) { return Math.ceil(value); },
                            sqrt: function (value) { return Math.sqrt(value); },
                            pow: function (base, exponent) { return Math.pow(base, exponent); },
                            // Mark this as a trusted Math proxy
                            __isMathProxy: true
                        };
                        whitelist.exitCall();
                        return mathProxy;
                    }
                    if (staticClass === "eu.jstack.jflow.core.operators.FlowUtils") {
                        // Return a FlowUtils proxy object that allows method calls
                        var flowUtilsProxy = {
                            date: function (dateInput) {
                                // Handle both string and Date object inputs
                                if (typeof dateInput === 'string') {
                                    var date = new Date(dateInput);
                                    if (isNaN(date.getTime())) {
                                        whitelist.exitCall();
                                        throw new Error("FlowUtils.date() received invalid date string: ".concat(dateInput));
                                    }
                                    return date;
                                }
                                else if (dateInput instanceof Date) {
                                    return dateInput;
                                }
                                else if (dateInput && typeof dateInput === 'object') {
                                    // Try to convert object to date if it has date-like properties
                                    var dateStr = dateInput.toString();
                                    var date = new Date(dateStr);
                                    if (!isNaN(date.getTime())) {
                                        return date;
                                    }
                                    whitelist.exitCall();
                                    throw new Error("FlowUtils.date() received invalid date object: ".concat(dateStr));
                                }
                                else {
                                    whitelist.exitCall();
                                    throw new Error("FlowUtils.date() requires a string or Date argument, got ".concat(typeof dateInput));
                                }
                            },
                            // Mark this as a trusted FlowUtils proxy
                            __isFlowUtilsProxy: true
                        };
                        whitelist.exitCall();
                        return flowUtilsProxy;
                    }
                    whitelist.exitCall();
                    throw new Error("Unsupported static class: ".concat(staticClass));
                }
                // Safe property access for method lookup
                var valueInTopContext = head && Object.prototype.hasOwnProperty.call(head, ast.methodName)
                    ? head[ast.methodName]
                    : undefined;
                if (valueInTopContext) {
                    var evaluatedArguments = ast.args.map(function (arg) { return evaluateArg_1(arg); }); // <- arguments are evaluated lazily
                    if (typeof valueInTopContext === "function") {
                        var boundFn = valueInTopContext.bind(head);
                        try {
                            var result = boundFn.apply(void 0, evaluatedArguments);
                            whitelist.exitCall();
                            return result;
                        }
                        catch (error) {
                            whitelist.exitCall();
                            throw error;
                        }
                    }
                }
                if (fallbackToFunctions) {
                    // method wasn't found - let's look in functions and variables
                    var entryInFunctionsAndVariables = getValueInProvidedFuncsAndVars(ast.methodName);
                    if (entryInFunctionsAndVariables.isSome &&
                        typeof entryInFunctionsAndVariables.value === "function") {
                        var evaluatedArguments = ast.args.map(function (arg) { return evaluateArg_1(arg); });
                        try {
                            var result = entryInFunctionsAndVariables.value.apply(entryInFunctionsAndVariables, evaluatedArguments);
                            whitelist.exitCall();
                            return result;
                        }
                        catch (error) {
                            whitelist.exitCall();
                            throw error;
                        }
                    }
                }
                whitelist.exitCall();
                if (!ast.nullSafeNavigation) {
                    throw new Error("Method " + ast.methodName + " not found.");
                }
                return null;
            }
            case "Negative": {
                var operand = evaluate(ast.value);
                if (typeof operand === "number") {
                    return operand * -1;
                }
                throw new Error("unary (-) operator applied to " + stringify(operand));
            }
            case "NullLiteral": {
                return null;
            }
            case "NumberLiteral": {
                return ast.value;
            }
            case "OpAnd": {
                var left = evaluate(ast.left);
                if (!disableBoolOpChecks && typeof left !== "boolean") {
                    throw new Error(stringify(left) + " is not a boolean");
                }
                if (!left) {
                    return !!left;
                }
                var right = evaluate(ast.right);
                if (!disableBoolOpChecks && typeof right !== "boolean") {
                    throw new Error(stringify(right) + " is not a boolean");
                }
                return !!right;
            }
            case "OpDivide": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                return binFloatOp(function (a, b) { return a / b; })(left, right);
            }
            case "OpEQ": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                // boolean, number, string, null
                return left === right;
            }
            case "OpGE": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
                    return binStringOp(function (a, b) { return a >= b; })(left, right);
                }
                return binFloatOp(function (a, b) { return a >= b; }, true)(left, right);
            }
            case "OpGT": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
                    return binStringOp(function (a, b) { return a > b; })(left, right);
                }
                return binFloatOp(function (a, b) { return a > b; }, true)(left, right);
            }
            case "OpLE": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
                    return binStringOp(function (a, b) { return a <= b; })(left, right);
                }
                return binFloatOp(function (a, b) { return a <= b; }, true)(left, right);
            }
            case "OpLT": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
                    return binStringOp(function (a, b) { return a < b; })(left, right);
                }
                return binFloatOp(function (a, b) { return a < b; }, true)(left, right);
            }
            case "OpMatches": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                return binStringOp(function (a, b) {
                    // Use safe regex compilation with validation
                    try {
                        return safeCompileRegex(b, regexValidator)(a);
                    }
                    catch (error) {
                        throw new Error("Regex validation failed: ".concat(error.message));
                    }
                })(left, right);
            }
            case "OpBetween": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                if (!Array.isArray(right) || right.length !== 2) {
                    throw new Error("Right operand for the between operator has to be a two-element list");
                }
                var firstValue = right[0], secondValue = right[1];
                return firstValue <= left && left <= secondValue;
            }
            case "OpMinus": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                return binFloatOp(function (a, b) { return a - b; })(left, right);
            }
            case "OpModulus": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                return binFloatOp(function (a, b) { return a % b; })(left, right);
            }
            case "OpMultiply": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                return binFloatOp(function (a, b) { return a * b; })(left, right);
            }
            case "OpNE": {
                var left = evaluate(ast.left);
                var right = evaluate(ast.right);
                // boolean, number, string, null
                return left !== right;
            }
            case "OpNot": {
                var exp = evaluate(ast.expression);
                return !exp;
            }
            case "OpOr": {
                var left = evaluate(ast.left);
                if (!disableBoolOpChecks && typeof left !== "boolean") {
                    throw new Error(stringify(left) + " is not a boolean");
                }
                if (left) {
                    return !!left;
                }
                var right = evaluate(ast.right);
                if (!disableBoolOpChecks && typeof right !== "boolean") {
                    throw new Error(stringify(right) + " is not a boolean");
                }
                return !!right;
            }
            case "OpPlus": {
                var left = (_c = evaluate(ast.left)) !== null && _c !== void 0 ? _c : null;
                var right = (_d = evaluate(ast.right)) !== null && _d !== void 0 ? _d : null;
                var isStringOrNumber = function (value) {
                    return (typeof value == "bigint" ||
                        typeof value === "string" ||
                        typeof value === "number" ||
                        value === null);
                };
                if (!isStringOrNumber(left)) {
                    throw new Error(stringify(left) + " is not a string or number.");
                }
                if (!isStringOrNumber(right)) {
                    throw new Error(stringify(right) + " is not a string or number.");
                }
                if (left === null && right === null) {
                    throw new Error("Operator + is not valid between operands null and null");
                }
                if (left == null && typeof right === "number") {
                    throw new Error("Operator + is not valid between operands null and of type number");
                }
                if (typeof left == "number" && right === null) {
                    throw new Error("Operator + is not valid between operands of type number and null");
                }
                // any is because typescript is being unreasonable here
                return left + right;
            }
            case "OpPower": {
                var base = evaluate(ast.base);
                var expression = evaluate(ast.expression);
                return binFloatOp(function (a, b) { return Math.pow(a, b); })(base, expression);
            }
            case "Projection": {
                var nullSafeNavigation = ast.nullSafeNavigation, expression_1 = ast.expression;
                var head = getHead();
                if (head === null && nullSafeNavigation) {
                    return null;
                }
                if (Array.isArray(head)) {
                    return head.map(function (v) {
                        stack.push(v);
                        var result = evaluate(expression_1);
                        stack.pop();
                        return result;
                    });
                }
                if (head && typeof head === "object") {
                    return Object.entries(head).map(function (_a) {
                        var key = _a[0], value = _a[1];
                        stack.push({ key: key, value: value });
                        var result = evaluate(expression_1);
                        stack.pop();
                        return result;
                    });
                }
                throw new Error("Cannot run expression on non-array " + stringify(head));
            }
            case "PropertyReference": {
                var nullSafeNavigation = ast.nullSafeNavigation, propertyName = ast.propertyName;
                // Track property chain depth to prevent uncontrolled traversal
                try {
                    whitelist.enterPropertyChain();
                    whitelist.validatePropertyAccess(propertyName);
                }
                catch (error) {
                    whitelist.exitPropertyChain();
                    throw new Error("Security violation: ".concat(error.message));
                }
                if (isCompound && !isFirstInCompound) {
                    // we can only get the head.
                    var head = getHead();
                    if (head === null || typeof head === "undefined") {
                        whitelist.exitPropertyChain();
                        if (nullSafeNavigation || disableNullPointerExceptions) {
                            return null;
                        }
                        throw new Error("Cannot chain property \"".concat(propertyName, "\" off of ").concat(head === null ? "null" : "undefined"));
                    }
                    // Validate object access for sensitive object detection
                    try {
                        whitelist.validateObjectAccess(head);
                    }
                    catch (error) {
                        whitelist.exitPropertyChain();
                        throw new Error("Security violation: ".concat(error.message));
                    }
                    if (!Object.prototype.hasOwnProperty.call(head, propertyName) || typeof head[propertyName] === "undefined") {
                        whitelist.exitPropertyChain();
                        if (nullSafeNavigation) {
                            // This doesn't seem right at first, but it actually works like that.
                            // we can do ?.nonexistantproperty
                            // and it will return null.
                            return null;
                        }
                        if (fallbackToVariables) {
                            var res = getValueInProvidedFuncsAndVars(propertyName);
                            if (res.isSome) {
                                return res.value;
                            }
                        }
                        if (disableNullPointerExceptions) {
                            return null;
                        }
                        throw new Error("Null Pointer Exception: Property " +
                            stringify(propertyName) +
                            " not found in head (last position)" +
                            " of context " +
                            stringify(stack));
                    }
                    // Use safe property access to prevent prototype pollution
                    if (Object.prototype.hasOwnProperty.call(head, propertyName)) {
                        var result = head[propertyName];
                        whitelist.exitPropertyChain();
                        return result;
                    }
                    whitelist.exitPropertyChain();
                    return undefined;
                }
                var valueInContext = searchForPropertyValueInContextStack(propertyName);
                if (isNone(valueInContext)) {
                    whitelist.exitPropertyChain();
                    if (nullSafeNavigation) {
                        return null;
                    }
                    if (fallbackToVariables) {
                        var res = getValueInProvidedFuncsAndVars(propertyName);
                        if (res.isSome) {
                            return res.value;
                        }
                    }
                    if (disableNullPointerExceptions) {
                        return null;
                    }
                    throw new Error("Null Pointer Exception: Property " +
                        stringify(propertyName) +
                        " not found in context " +
                        stringify(stack));
                }
                // Validate the accessed object for sensitive object detection
                try {
                    whitelist.validateObjectAccess(valueInContext.value);
                }
                catch (error) {
                    whitelist.exitPropertyChain();
                    throw new Error("Security violation: ".concat(error.message));
                }
                whitelist.exitPropertyChain();
                return valueInContext.value;
            }
            case "SelectionAll": {
                var nullSafeNavigation = ast.nullSafeNavigation, expression_2 = ast.expression;
                var head = getHead();
                if (head === null && nullSafeNavigation) {
                    return null;
                }
                if (Array.isArray(head)) {
                    return head.filter(function (v, i) {
                        stack.push(v);
                        var result = evaluate(expression_2);
                        stack.pop();
                        if (disableBoolOpChecks) {
                            return Boolean(result);
                        }
                        if (typeof result !== "boolean") {
                            throw new Error("Result " +
                                stringify(result) +
                                " at index " +
                                i +
                                " of selection expression is not Boolean");
                        }
                        return result === true;
                    });
                }
                if (head && typeof head === "object") {
                    // pojo
                    return Object.fromEntries(Object.entries(head).filter(function (_a, i) {
                        var key = _a[0], value = _a[1];
                        stack.push({ key: key, value: value });
                        var result = evaluate(expression_2);
                        stack.pop();
                        if (disableBoolOpChecks) {
                            return Boolean(result);
                        }
                        if (typeof result !== "boolean") {
                            throw new Error("Result " +
                                stringify(result) +
                                " at index " +
                                i +
                                " of selection expression is not Boolean");
                        }
                        return result === true;
                    }));
                }
                throw new Error("Cannot run selection expression on non-collection " + stringify(head));
            }
            case "SelectionFirst": {
                var nullSafeNavigation = ast.nullSafeNavigation, expression = ast.expression;
                var head = getHead();
                if (head === null && nullSafeNavigation) {
                    return null;
                }
                if (Array.isArray(head)) {
                    return find(head, expression, false);
                }
                if (head && typeof head === "object") {
                    var result = find(Object.entries(head).map(function (_a) {
                        var key = _a[0], value = _a[1];
                        return ({ key: key, value: value });
                    }), expression, false);
                    return result && (_a = {}, _a[result.key] = result.value, _a);
                }
                throw new Error("Cannot run selection expression on non-array " + stringify(head));
            }
            case "SelectionLast": {
                var nullSafeNavigation = ast.nullSafeNavigation, expression = ast.expression;
                var head = getHead();
                if (head === null && nullSafeNavigation) {
                    return null;
                }
                if (Array.isArray(head)) {
                    return find(head, expression, true);
                }
                if (head && typeof head === "object") {
                    var result = find(Object.entries(head).map(function (_a) {
                        var key = _a[0], value = _a[1];
                        return ({ key: key, value: value });
                    }), expression, true);
                    return result && (_b = {}, _b[result.key] = result.value, _b);
                }
                throw new Error("Cannot run selection expression on non-array " + stringify(head));
            }
            case "StringLiteral": {
                return ast.value;
            }
            case "Ternary": {
                var expression = ast.expression, ifTrue = ast.ifTrue, ifFalse = ast.ifFalse;
                var conditionResult = evaluate(expression);
                if (conditionResult === true ||
                    (disableBoolOpChecks && Boolean(conditionResult))) {
                    return evaluate(ifTrue);
                }
                else if (conditionResult === false || conditionResult === null) {
                    return evaluate(ifFalse);
                }
                else {
                    throw new Error("Unexpected non boolean/null in Ternary conditional expression: " +
                        stringify(conditionResult));
                }
            }
            case "VariableReference": {
                var valueInFuncsAndVars = getValueInProvidedFuncsAndVars(ast.variableName);
                if (isNone(valueInFuncsAndVars)) {
                    if (disableNullPointerExceptions) {
                        return null;
                    }
                    throw new Error("Null Pointer Exception: variable " +
                        stringify(ast.variableName) +
                        " not found");
                }
                return valueInFuncsAndVars.value;
            }
        }
    };
    return function (ast) {
        // Reset property chain depth for each new expression evaluation
        whitelist.resetPropertyChain();
        return evaluate(ast);
    };
};
//# sourceMappingURL=Evaluate.js.map