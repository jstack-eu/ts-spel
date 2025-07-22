var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { ParsingError } from "./CustomErrors";
import { fastCharCodeIsWhitespace } from "./fastIsWhitespace";
import _stringLiteral from "./stringLiteralSPELStyle";
// turn true for debugging.
var logFlag = false;
/**
 * Produces an AST representing the input SPEL expression
 *
 * ### Example (es module)
 * ```js
 * import { parse } from 'ts-spel'
 * console.log(parse('4'))
 * // => { type: 'NumberLiteral', value: 4 }
 * ```
 *
 * ### Example (commonjs)
 * ```js
 * var double = require('ts-spel').parse;
 * console.log(double(4))
 * // => { type: 'NumberLiteral', value: 4 }
 * ```
 *
 * @param input - SPEL expression
 * @param graceful - if true, will not error if the expression is incomplete -
 *  to be used for autocompletion
 *  (where we need an AST built to the current position to figure out the context of the current cursor position)
 * @returns AST representing input
 */
export var parse = function (input, graceful, allowWeirdQuoteCharacters) {
    if (graceful === void 0) { graceful = false; }
    if (allowWeirdQuoteCharacters === void 0) { allowWeirdQuoteCharacters = false; }
    var index = 0;
    var log = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (logFlag) {
            console.log.apply(console, __spreadArray([input.slice(index)], args, false));
        }
    };
    var utils = {
        // s : 'a'  ==>  var s = function() { return char('a'); };
        char: function (expected) {
            var c;
            return index < input.length && (c = input.charAt(index++)) === expected
                ? c
                : (function () {
                    if (c && c !== expected) {
                        index--;
                    }
                    return null;
                })();
        },
        chars: function (expected) {
            var backtrack = index;
            var success = true;
            for (var i = 0; success && i < expected.length; i++) {
                success = Boolean(utils.char(expected[i]));
            }
            if (!success) {
                index = backtrack;
                return null;
            }
            return expected;
        },
        // s : /[0-9]+/  ==>  var s = function() { return regExp(/[0-9]+/); };
        regExp: function (regexp) {
            var match;
            if (index < input.length &&
                (match = regexp.exec(input.substr(index))) &&
                match.index === 0) {
                index += match[0].length;
                return match[0];
            }
            return null;
        },
        // s : s1 | s2  ==>  var s = function() { return firstOf(s1, s2); };
        firstOf: function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var backtrack = index;
            for (var len = args.length, i = 0; i < len; i++) {
                var val = args[i]();
                if (val !== null) {
                    return val;
                }
                index = backtrack;
            }
            return null;
        },
        // s : t*  ==>  s : s';  s' : t s' | empty  ==>  var s = function() { return zeroOrMore(t); };
        zeroOrMore: function (func) {
            for (;;) {
                var backtrack = index;
                if (!func()) {
                    index = backtrack;
                    return true;
                }
            }
        },
        whitSpc: function () {
            while (index < input.length &&
                fastCharCodeIsWhitespace(input.charCodeAt(index))) {
                index += 1;
            }
            return true;
        },
        identifier: function () {
            return utils.regExp(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        },
        stringLiteral: function () {
            var match = _stringLiteral(input.slice(index), allowWeirdQuoteCharacters);
            if (match === -1) {
                if (graceful) {
                    return -1;
                }
                throw new ParsingError(input, index, "Non-terminating quoted string");
            }
            if (match) {
                index = index + match[1];
                return match[0];
            }
            return null;
        },
    };
    var someInputRemaining = function () { return index !== input.length; };
    var getOpIsClosed = function () {
        return graceful
            ? (function () {
                utils.whitSpc();
                return someInputRemaining();
            })()
            : undefined;
    };
    var expression = function () {
        log("expression");
        utils.whitSpc();
        var exp1 = logicalOrExpression();
        utils.whitSpc();
        if (utils.char("?")) {
            if (utils.char(":")) {
                log("after elvis operator");
                var exp2 = expression();
                log("after expression eaten post elvis");
                if (!exp2 && !graceful) {
                    throw new ParsingError(input, index, "Expected expression after elvis (?:)");
                }
                return {
                    type: "Elvis",
                    expression: exp1,
                    ifFalse: exp2,
                    _isClosed: getOpIsClosed(),
                };
            }
            else {
                var exp2 = null;
                var exp3 = null;
                if (((exp2 = expression()) && utils.char(":") && (exp3 = expression())) ||
                    graceful) {
                    return {
                        type: "Ternary",
                        expression: exp1,
                        ifTrue: exp2,
                        ifFalse: exp3,
                        _isClosed: getOpIsClosed(),
                    };
                }
                else {
                    throw new ParsingError(input, index, "Incomplete Ternary");
                }
            }
        }
        else {
            return exp1;
        }
    };
    var logicalOrExpression = function () {
        log("logicalOrExpression");
        utils.whitSpc();
        var left = logicalAndExpression();
        utils.whitSpc();
        utils.zeroOrMore(function () {
            utils.whitSpc();
            var right;
            if (utils.char("|")) {
                if (utils.char("|")) {
                    if ((right = logicalAndExpression()) || graceful) {
                        left = {
                            type: "OpOr",
                            left: left,
                            right: right,
                            _isClosed: getOpIsClosed(),
                        };
                        return left;
                    }
                    else {
                        throw new ParsingError(input, index, "No right operand for ||");
                    }
                }
                else {
                    throw new ParsingError(input, index, "Missing Character |");
                }
            }
            // Now opOr
            var backtrack = index;
            var keyword = utils.identifier();
            if ((keyword === null || keyword === void 0 ? void 0 : keyword.toLowerCase()) === "or") {
                if ((right = relationalExpression()) || graceful) {
                    left = {
                        type: "OpOr",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                    return left;
                }
                else {
                    throw new ParsingError(input, index, "No right operand for OR");
                }
            }
            else {
                index = backtrack;
            }
            return null;
        });
        return left;
    };
    var logicalAndExpression = function () {
        log("logicalAndExpression");
        utils.whitSpc();
        var left = relationalExpression();
        utils.whitSpc();
        utils.zeroOrMore(function () {
            utils.whitSpc();
            var right;
            if (utils.char("&")) {
                if (utils.char("&")) {
                    if ((right = relationalExpression()) || graceful) {
                        left = {
                            type: "OpAnd",
                            left: left,
                            right: right,
                            _isClosed: getOpIsClosed(),
                        };
                        return left;
                    }
                    else {
                        throw new ParsingError(input, index, "No right operand for &&");
                    }
                }
                else {
                    throw new ParsingError(input, index, "Missing Character &");
                }
            }
            // Now try AND/and
            var backtrack = index;
            var keyword = utils.identifier();
            if ((keyword === null || keyword === void 0 ? void 0 : keyword.toLowerCase()) === "and") {
                if ((right = relationalExpression()) || graceful) {
                    left = {
                        type: "OpAnd",
                        left: left,
                        right: right,
                    };
                    return left;
                }
                else {
                    throw new ParsingError(input, index, "No right operand for AND");
                }
            }
            else {
                index = backtrack;
            }
            return null;
        });
        return left;
    };
    /*
    OPEQ NOT IMPLEMENTED!!
    */
    var relationalExpression = function () {
        log("relationalExpression");
        utils.whitSpc();
        var left = sumExpression();
        var right = null;
        var backtrack = index;
        utils.whitSpc();
        if (utils.char(">")) {
            if (utils.char("=")) {
                if ((right = sumExpression()) || graceful) {
                    return {
                        type: "OpGE",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                }
                else {
                    throw new ParsingError(input, index, "No right operand for >=");
                }
            }
            else if ((right = sumExpression()) || graceful) {
                return {
                    type: "OpGT",
                    left: left,
                    right: right,
                    _isClosed: getOpIsClosed(),
                };
            }
            else {
                throw new ParsingError(input, index, "No right operand for >");
            }
        }
        else if (utils.char("<")) {
            if (utils.char("=")) {
                if ((right = sumExpression()) || graceful) {
                    return {
                        type: "OpLE",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                }
                else {
                    throw new ParsingError(input, index, "No right operand for <=");
                }
            }
            else if ((right = sumExpression()) || graceful) {
                return {
                    type: "OpLT",
                    left: left,
                    right: right,
                    _isClosed: getOpIsClosed(),
                };
            }
            else {
                throw new ParsingError(input, index, "No right operand for <");
            }
        }
        else if (utils.char("!")) {
            if (utils.char("=")) {
                if ((right = sumExpression()) || graceful) {
                    return {
                        type: "OpNE",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                }
                else {
                    throw new ParsingError(input, index, "No right operand for !=");
                }
            }
            else {
                index = backtrack;
            }
        }
        else if (utils.char("=")) {
            log("got =");
            if (utils.char("=")) {
                if ((right = sumExpression()) || graceful) {
                    return {
                        type: "OpEQ",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                }
                else {
                    throw new ParsingError(input, index, "No right operand for ==");
                }
            }
            else {
                throw new ParsingError(input, index, "Assignment not allowed");
            }
        }
        else {
            var backtrack_1 = index;
            var keyword = utils.identifier();
            if (keyword === "matches") {
                if ((right = sumExpression()) || graceful) {
                    return {
                        type: "OpMatches",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                }
                else {
                    throw new ParsingError(input, index, "No right operand for 'matches'");
                }
            }
            else if (keyword === "between") {
                if ((right = sumExpression()) || graceful) {
                    return {
                        type: "OpBetween",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                }
                else {
                    throw new ParsingError(input, index, "No right operand for 'between'");
                }
            }
            else {
                if (keyword && !["and", "or"].includes(keyword === null || keyword === void 0 ? void 0 : keyword.toLowerCase())) {
                    if (!graceful) {
                        throw new ParsingError(input, index, "Not an Operator", "\"".concat(keyword, "\" is not an operator"));
                    }
                }
                index = backtrack_1;
            }
        }
        log("fell through");
        return left;
    };
    var sumExpression = function () {
        log("sumExpression");
        utils.whitSpc();
        var left = productExpression();
        utils.whitSpc();
        log("sumExpression left", left);
        utils.zeroOrMore(function () {
            utils.whitSpc();
            log("in zeroOrMore");
            var right = null;
            if (utils.char("+")) {
                log("pluscase");
                right = productExpression();
                if (!right && !graceful) {
                    throw new ParsingError(input, index, "No right operand for +");
                }
                left = {
                    type: "OpPlus",
                    left: left,
                    right: right,
                    _isClosed: getOpIsClosed(),
                };
                return left;
            }
            else if (utils.char("-")) {
                log("minuscase");
                right = productExpression();
                if (!right && !graceful) {
                    throw new ParsingError(input, index, "No right operand for -");
                }
                left = {
                    type: "OpMinus",
                    left: left,
                    right: right,
                    _isClosed: getOpIsClosed(),
                };
                return left;
            }
            else {
                log("missed all");
            }
            return null;
        });
        return left;
    };
    var productExpression = function () {
        log("productExpression");
        utils.whitSpc();
        var left = powerExpression();
        utils.whitSpc();
        utils.zeroOrMore(function () {
            var right = null;
            if (utils.char("*")) {
                if (!left) {
                    throw new ParsingError(input, index - 1, "No left operand for *");
                }
                right = powerExpression();
                if (right || graceful) {
                    left = {
                        type: "OpMultiply",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                    return left;
                }
                throw new ParsingError(input, index, "No right operand for *");
            }
            else if (utils.char("/")) {
                if (!left) {
                    throw new ParsingError(input, index - 1, "No left operand for /");
                }
                right = powerExpression();
                if (right || graceful) {
                    left = {
                        type: "OpDivide",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                    return left;
                }
                throw new ParsingError(input, index, "No right operand for /");
            }
            else if (utils.char("%")) {
                if (!left) {
                    throw new ParsingError(input, index - 1, "No left operand for %");
                }
                right = powerExpression();
                if (right || graceful) {
                    left = {
                        type: "OpModulus",
                        left: left,
                        right: right,
                        _isClosed: getOpIsClosed(),
                    };
                    return left;
                }
                throw new ParsingError(input, index, "No right operand for %");
            }
            return null;
        });
        return left;
    };
    var powerExpression = function () {
        log("powerExpression");
        utils.whitSpc();
        var left = unaryExpression();
        utils.whitSpc();
        var backtrack = index;
        if (utils.char("^")) {
            var right = unaryExpression();
            return {
                type: "OpPower",
                base: left,
                expression: right,
                _isClosed: getOpIsClosed(),
            };
        }
        else {
            index = backtrack;
        }
        return left;
    };
    var unaryExpression = function () {
        log("unaryExpression");
        return utils.firstOf(negative, not, primaryExpression);
    };
    var negative = function () {
        log("negative");
        var operand = null;
        if (utils.char("-") && (operand = unaryExpression())) {
            return {
                type: "Negative",
                value: operand,
            };
        }
        log("negative (null)");
        return null;
    };
    var not = function () {
        log("not");
        var operand = null;
        if (utils.char("!") && ((operand = unaryExpression()) || graceful)) {
            return {
                type: "OpNot",
                expression: operand,
            };
        }
        return null;
    };
    var primaryExpression = function () {
        log("primaryExpression");
        utils.whitSpc();
        var sn = startNode();
        log("after startNode got");
        var continuations = [];
        utils.zeroOrMore(function () {
            utils.whitSpc();
            var nextNode = null;
            if ((nextNode = node())) {
                continuations.push(nextNode);
                return nextNode;
            }
            return null;
        });
        if (continuations.length > 0) {
            return {
                type: "CompoundExpression",
                expressionComponents: __spreadArray([sn], continuations, true),
            };
        }
        return sn;
    };
    var startNode = function () {
        log("startNode");
        return utils.firstOf(parenExpression, literal, functionOrVar, function () { return methodOrProperty(false); }, inlineListOrMap);
    };
    var node = function () {
        log("node");
        return utils.firstOf(projection, selection, navProperty, indexExp, functionOrVar);
    };
    var navProperty = function () {
        log("navProperty");
        if (utils.char(".")) {
            return (methodOrProperty(false) ||
                (function () {
                    if (graceful) {
                        return {
                            type: "PropertyReference",
                            propertyName: "",
                            nullSafeNavigation: false,
                        };
                    }
                    throw new ParsingError(input, index, "Expected property after .");
                })());
        }
        var backtrack = index;
        if (utils.char("?") && utils.char(".")) {
            return (methodOrProperty(true) ||
                (function () {
                    if (graceful) {
                        return {
                            type: "PropertyReference",
                            propertyName: "",
                            nullSafeNavigation: true,
                        };
                    }
                    throw new ParsingError(input, index, "Expected property after ?.");
                })());
        }
        else {
            index = backtrack;
        }
        return null;
    };
    var indexExp = function () {
        log("indexExp");
        return utils.firstOf(nullSafeIndex, notNullSafeIndex);
    };
    var nullSafeIndex = function () {
        log("nullSafeIndex");
        var backtrack = index;
        var innerExpression = null;
        if (utils.char("?") && utils.char("[")) {
            if ((innerExpression = expression()) || graceful) {
                if (utils.char("]")) {
                    return {
                        type: "Indexer",
                        nullSafeNavigation: true,
                        index: innerExpression,
                    };
                }
                else if (graceful) {
                    return {
                        type: "Indexer",
                        nullSafeNavigation: true,
                        index: innerExpression,
                        __unclosed: true,
                    };
                }
                throw new ParsingError(input, index, "Expected ]");
            }
            else {
                if (utils.char("]")) {
                    index -= 1;
                    throw new ParsingError(input, index, "Expression expected in []");
                }
                throw new ParsingError(input, index, "Expected ]");
            }
        }
        else {
            index = backtrack;
        }
        return null;
    };
    var notNullSafeIndex = function () {
        log("notNullSafeIndex");
        var backtrack = index;
        var innerExpression = null;
        if (utils.char("[")) {
            if ((innerExpression = expression()) || graceful) {
                if (utils.char("]")) {
                    return {
                        type: "Indexer",
                        nullSafeNavigation: false,
                        index: innerExpression,
                    };
                }
                else if (graceful) {
                    return {
                        type: "Indexer",
                        nullSafeNavigation: false,
                        index: innerExpression,
                        __unclosed: true,
                    };
                }
                throw new ParsingError(input, index, "Expected ]");
            }
            else {
                if (utils.char("]")) {
                    index -= 1;
                    throw new ParsingError(input, index, "Expression expected in []");
                }
                throw new ParsingError(input, index, "Expected ]");
            }
        }
        else {
            index = backtrack;
        }
        return null;
    };
    var methodOrProperty = function (nullSafeNavigation) {
        log("methodOrProperty");
        utils.whitSpc();
        var args = [];
        var ident = null;
        if ((ident = utils.identifier())) {
            var fnbacktrack = index;
            if (utils.char("(")) {
                var precededByComma_1 = false;
                if (utils.zeroOrMore(function () {
                    var arg = expression();
                    if (arg) {
                        args.push(arg);
                        precededByComma_1 = Boolean(utils.char(",")) || Boolean(utils.char("T"));
                        return arg;
                    }
                    else if (graceful && precededByComma_1) {
                        args.push(null);
                    }
                    return null;
                })) {
                    if (utils.char(")")) {
                        return {
                            type: "MethodReference",
                            nullSafeNavigation: nullSafeNavigation,
                            methodName: ident,
                            args: args,
                        };
                    }
                    else if (graceful) {
                        return {
                            type: "MethodReference",
                            nullSafeNavigation: nullSafeNavigation,
                            methodName: ident,
                            args: args,
                            __unclosed: true,
                        };
                    }
                }
                throw new ParsingError(input, index, "Expected ) for method call");
            }
            else {
                index = fnbacktrack;
                return {
                    type: "PropertyReference",
                    propertyName: ident,
                    nullSafeNavigation: nullSafeNavigation,
                };
            }
        }
        return null;
    };
    var functionOrVar = function () {
        log("functionOrVar");
        utils.whitSpc();
        var args = [];
        var ident = null;
        if (utils.char("#") && (ident = utils.identifier())) {
            var fnbacktrack = index;
            if (utils.char("(")) {
                if (utils.zeroOrMore(function () {
                    var arg = expression();
                    if (arg) {
                        args.push(arg);
                        utils.char(",");
                        return arg;
                    }
                    return null;
                })) {
                    if (utils.char(")")) {
                        return {
                            type: "FunctionReference",
                            nullSafeNavigation: false,
                            functionName: ident,
                            args: args,
                        };
                    }
                    else if (graceful) {
                        return {
                            type: "FunctionReference",
                            nullSafeNavigation: false,
                            functionName: ident,
                            args: args,
                            __unclosed: true,
                        };
                    }
                }
                throw new ParsingError(input, index, "Expected ) for function call");
            }
            else {
                index = fnbacktrack;
                return {
                    type: "VariableReference",
                    variableName: ident,
                };
            }
        }
        return null;
    };
    var selection = function () {
        log("selection");
        utils.whitSpc();
        var backtrack = index;
        var nullSafeNavigation = (function () {
            if (utils.char("?")) {
                if (utils.char(".")) {
                    return true;
                }
                else {
                    index = backtrack;
                    return null;
                }
            }
            else if (utils.char(".")) {
                return false;
            }
            else {
                return null;
            }
        })();
        log("nullSafeNavigation " + nullSafeNavigation);
        if (nullSafeNavigation === null) {
            return null;
        }
        var result = utils.firstOf(function () {
            var exp;
            if (utils.char("?") && utils.char("[")) {
                if (utils.whitSpc() &&
                    (exp = expression()) &&
                    utils.whitSpc() &&
                    utils.char("]")) {
                    return {
                        type: "SelectionAll",
                        nullSafeNavigation: nullSafeNavigation,
                        expression: exp,
                    };
                }
                else if (graceful) {
                    return {
                        type: "SelectionAll",
                        nullSafeNavigation: nullSafeNavigation,
                        expression: exp,
                        __unclosed: true,
                    };
                }
                else {
                    throw new ParsingError(input, index, "Expected ] for selection expression ?[");
                }
            }
            return null;
        }, function () {
            var exp;
            if (utils.char("^") && utils.char("[")) {
                if ((exp = expression()) && utils.char("]")) {
                    return {
                        type: "SelectionFirst",
                        nullSafeNavigation: nullSafeNavigation,
                        expression: exp,
                    };
                }
                else if (graceful) {
                    return {
                        type: "SelectionFirst",
                        nullSafeNavigation: nullSafeNavigation,
                        expression: exp,
                        __unclosed: true,
                    };
                }
                else {
                    throw new ParsingError(input, index, "Expected ] for selection expression ^[");
                }
            }
            return null;
        }, function () {
            var exp;
            if (utils.char("$") && utils.char("[")) {
                if ((exp = expression()) && utils.char("]")) {
                    return {
                        type: "SelectionLast",
                        nullSafeNavigation: nullSafeNavigation,
                        expression: exp,
                    };
                }
                else if (graceful) {
                    return {
                        type: "SelectionLast",
                        nullSafeNavigation: nullSafeNavigation,
                        expression: exp,
                        __unclosed: true,
                    };
                }
                else {
                    throw new ParsingError(input, index, "Expected ] for selection expression $[");
                }
            }
            return null;
        });
        if (result === null) {
            index = backtrack;
            return null;
        }
        return result;
    };
    var projection = function () {
        log("projection");
        utils.whitSpc();
        var backtrack = index;
        var nullSafeNavigation = (function () {
            if (utils.char("?")) {
                if (utils.char(".")) {
                    return true;
                }
                else {
                    index = backtrack;
                    return null;
                }
            }
            else if (utils.char(".")) {
                return false;
            }
            else {
                return null;
            }
        })();
        if (nullSafeNavigation === null) {
            return null;
        }
        var exp;
        if (utils.char("!") && utils.char("[")) {
            if ((exp = expression()) && utils.char("]")) {
                return {
                    type: "Projection",
                    nullSafeNavigation: nullSafeNavigation,
                    expression: exp,
                };
            }
            else if (graceful) {
                return {
                    type: "Projection",
                    nullSafeNavigation: nullSafeNavigation,
                    expression: exp,
                    __unclosed: true,
                };
            }
            else {
                throw new ParsingError(input, index, "Expected ] for Projection expression ![");
            }
        }
        else {
            index = backtrack;
        }
        return null;
    };
    var string = function () {
        var stringLiteral = utils.stringLiteral();
        if (typeof stringLiteral === "string") {
            log("returning stringLiteral", stringLiteral);
            return {
                type: "StringLiteral",
                value: stringLiteral,
            };
        }
        if (stringLiteral === -1) {
            // it's unclosed, so let's just capture the rest
            var value = input.slice(index).trim().slice(1);
            index = input.length;
            return {
                type: "StringLiteral",
                value: value,
                __unclosed: true,
            };
        }
        return null;
    };
    var literal = function () {
        log("literal");
        return utils.firstOf(string, number, function () {
            return utils.regExp(/true/i) && {
                type: "BooleanLiteral",
                value: true,
            };
        }, function () {
            return utils.regExp(/false/i) && {
                type: "BooleanLiteral",
                value: false,
            };
        }, function () {
            return utils.regExp(/null/i) && {
                type: "NullLiteral",
            };
        });
    };
    var parenExpression = function () {
        log("parenExpression");
        var exp;
        if (utils.char("(")) {
            if ((exp = expression()) || graceful) {
                if (utils.char(")") || graceful) {
                    return exp;
                }
                throw new ParsingError(input, index, "Expected )");
            }
            if (utils.char(")")) {
                index -= 1;
                throw new ParsingError(input, index, "Expected expression in ()");
            }
            throw new ParsingError(input, index, "Expected )");
        }
        return null;
    };
    var inlineListOrMap = function () {
        log("inlineListOrMap");
        var listElements = [];
        var dict = {};
        /**
         * If we're in graceful mode, let's store any lists we find, and only return them if we don't also find a possible 'map'
         */
        var foundGracefulList;
        utils.whitSpc();
        if (utils.char("{")) {
            var fnbacktrack = index;
            // look for comma seperated list items
            if (utils.zeroOrMore(function () {
                var elem = expression();
                if (elem) {
                    // backtrack early if we hit a color: we're in a map
                    // so don't push the item onto listElements
                    var storeIx = index;
                    var foundColon = utils.char(":");
                    if (foundColon) {
                        index = storeIx;
                        return null;
                    }
                    listElements.push(elem);
                    utils.char(",");
                    utils.whitSpc();
                    return elem;
                }
                return null;
            })) {
                if (utils.char("}")) {
                    return {
                        type: "InlineList",
                        elements: listElements,
                    };
                }
                else if (graceful) {
                    // check for map first.
                    foundGracefulList = {
                        type: "InlineList",
                        elements: listElements,
                        __unclosed: true,
                    };
                }
            }
            index = fnbacktrack;
            // empty dict
            if (utils.whitSpc() &&
                utils.char(":") &&
                utils.whitSpc() &&
                utils.char("}")) {
                return {
                    type: "InlineMap",
                    elements: {},
                };
            }
            index = fnbacktrack;
            // look for dictionary key/value pairs
            var wasComma_1 = false;
            if (utils.zeroOrMore(function () {
                utils.whitSpc();
                var ident;
                var identInQuotes;
                var elem;
                if ((ident =
                    utils.identifier() ||
                        (function () {
                            var identInQuotes = string();
                            if (!identInQuotes) {
                                return null;
                            }
                            if (identInQuotes.__unclosed) {
                                throw new ParsingError(input, index, "Non-terminating quoted string");
                            }
                            return identInQuotes.value;
                        })())) {
                    if (utils.char(":") && ((elem = expression()) || graceful)) {
                        dict[ident] = elem;
                        wasComma_1 = Boolean(utils.char(","));
                        return elem;
                    }
                }
                else if (wasComma_1 && graceful) {
                    // we ended on a ','
                    dict[""] = null;
                    return null;
                }
                return null;
            }) &&
                utils.whitSpc()) {
                if (utils.char("}")) {
                    return {
                        type: "InlineMap",
                        elements: dict,
                    };
                }
                else if (graceful) {
                    if (Object.keys(dict).length === 0) {
                        return foundGracefulList;
                    }
                    return {
                        type: "InlineMap",
                        elements: dict,
                        __unclosed: true,
                    };
                }
            }
            else {
                index = fnbacktrack;
            }
            if (graceful && foundGracefulList) {
                return foundGracefulList;
            }
            throw new ParsingError(input, index, "Expected }");
        }
        return null;
    };
    // number : /\d+(?:\.\d+)?/
    var number = function () {
        utils.whitSpc();
        var str = utils.regExp(/\d+(?:\.\d+)?/);
        if (str) {
            return {
                type: "NumberLiteral",
                value: parseFloat(str),
            };
        }
        return null;
    };
    var result = expression();
    utils.whitSpc();
    if (index !== input.length && !graceful) {
        throw new ParsingError(input, index, "Expression Remaining", "input remaining: ".concat(input.slice(index)));
    }
    if (result === null && !graceful) {
        throw new ParsingError(input, index, "Generic");
    }
    return result;
};
//# sourceMappingURL=ParseToAst.js.map