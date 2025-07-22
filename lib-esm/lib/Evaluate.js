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
            if (typeof left !== "number" &&
                !(allowNull && (left === null || typeof left === "undefined"))) {
                throw new Error(stringify(left) + " is not a float");
            }
            if (typeof right !== "number" &&
                !(allowNull && (right === null || typeof right === "undefined"))) {
                throw new Error(stringify(right) + " is not a float");
            }
            return op((left !== null && left !== void 0 ? left : null), (right !== null && right !== void 0 ? right : null));
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
                try {
                    whitelist.validateMethodCall(head, ast.methodName);
                    whitelist.enterCall();
                }
                catch (error) {
                    throw new Error("Security violation: ".concat(error.message));
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
                        if (nullSafeNavigation) {
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