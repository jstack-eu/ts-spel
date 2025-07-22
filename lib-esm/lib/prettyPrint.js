var getOrder = function (ast) {
    switch (ast.type) {
        case "Ternary":
        case "Elvis":
            return 1;
        case "OpOr":
            return 2;
        case "OpAnd":
            return 3;
        case "OpGE":
        case "OpEQ":
        case "OpGT":
        case "OpLT":
        case "OpLE":
        case "OpMatches":
        case "OpBetween":
        case "OpNE":
            return 4;
        case "OpPlus":
        case "OpMinus":
            return 5;
        case "OpMultiply":
        case "OpModulus":
        case "OpDivide":
            return 6;
        case "OpPower":
            return 7;
        case "Negative":
        case "OpNot":
            return 8;
        default:
            return 9;
    }
};
var needsParen = function (parent, child) {
    return getOrder(parent) >= getOrder(child);
};
var prettyPrint = function (ast) {
    var maybeParen = function (child) {
        return needsParen(ast, child) ? "(".concat(prettyPrint(child), ")") : prettyPrint(child);
    };
    switch (ast.type) {
        case "BooleanLiteral": {
            return "".concat(ast.value);
        }
        case "CompoundExpression": {
            return ast.expressionComponents.reduce(function (prev, curr) {
                switch (curr.type) {
                    case "MethodReference":
                    case "PropertyReference":
                    case "SelectionAll":
                    case "SelectionFirst":
                    case "SelectionLast":
                    case "Projection":
                        var nullSafeNavigation = curr.nullSafeNavigation;
                        var nav = !prev ? "" : nullSafeNavigation ? "?." : ".";
                        return "".concat(prev).concat(nav).concat(prettyPrint(curr));
                    default:
                        return "".concat(prev).concat(prettyPrint(curr));
                }
            }, "");
        }
        case "Elvis": {
            return "".concat(maybeParen(ast.expression), " ?: ").concat(maybeParen(ast.ifFalse));
        }
        case "FunctionReference": {
            return "#".concat(ast.functionName, "(").concat(ast.args.map(prettyPrint).join(", "), ")");
        }
        case "Indexer": {
            return "[".concat(prettyPrint(ast.index), "]");
        }
        case "InlineList": {
            return "{".concat(ast.elements.map(prettyPrint).join(", "), "}");
        }
        case "InlineMap": {
            return "{".concat(Object.entries(ast.elements)
                .map(function (_a) {
                var k = _a[0], v = _a[1];
                var key = /^([a-zA-Z_$][a-zA-Z0-9_$]*)/.test(k)
                    ? k
                    : "\"".concat(k.replace("\"", "\"\""), "\"");
                return "".concat(key, ": ").concat(prettyPrint(v));
            })
                .join(",\n"), "}");
        }
        case "MethodReference": {
            return "".concat(ast.methodName, "(").concat(ast.args.map(prettyPrint).join(", "), ")");
        }
        case "Negative": {
            return "-".concat(maybeParen(ast.value));
        }
        case "NullLiteral": {
            return "null";
        }
        case "NumberLiteral": {
            return "".concat(ast.value);
        }
        case "OpAnd": {
            return "".concat(maybeParen(ast.left), " && ").concat(maybeParen(ast.right));
        }
        case "OpBetween": {
            return "".concat(maybeParen(ast.left), " between ").concat(maybeParen(ast.right));
        }
        case "OpDivide": {
            return "".concat(maybeParen(ast.left), " / ").concat(maybeParen(ast.right));
        }
        case "OpEQ": {
            return "".concat(maybeParen(ast.left), " == ").concat(maybeParen(ast.right));
        }
        case "OpGE": {
            return "".concat(maybeParen(ast.left), " >= ").concat(maybeParen(ast.right));
        }
        case "OpGT": {
            return "".concat(maybeParen(ast.left), " > ").concat(maybeParen(ast.right));
        }
        case "OpLE": {
            return "".concat(maybeParen(ast.left), " <= ").concat(maybeParen(ast.right));
        }
        case "OpLT": {
            return "".concat(maybeParen(ast.left), " < ").concat(maybeParen(ast.right));
        }
        case "OpMatches": {
            return "".concat(maybeParen(ast.left), " matches ").concat(maybeParen(ast.right));
        }
        case "OpMinus": {
            return "".concat(maybeParen(ast.left), " - ").concat(maybeParen(ast.right));
        }
        case "OpModulus": {
            return "".concat(maybeParen(ast.left), " % ").concat(maybeParen(ast.right));
        }
        case "OpMultiply": {
            return "".concat(maybeParen(ast.left), " * ").concat(maybeParen(ast.right));
        }
        case "OpNE": {
            return "".concat(maybeParen(ast.left), " != ").concat(maybeParen(ast.right));
        }
        case "OpNot": {
            return "!".concat(maybeParen(ast.expression));
        }
        case "OpOr": {
            return "".concat(maybeParen(ast.left), " || ").concat(maybeParen(ast.right));
        }
        case "OpPlus": {
            return "".concat(maybeParen(ast.left), " + ").concat(maybeParen(ast.right));
        }
        case "OpPower": {
            return "".concat(maybeParen(ast.base), "^").concat(maybeParen(ast.expression));
        }
        case "Projection": {
            return "![".concat(prettyPrint(ast.expression), "]");
        }
        case "PropertyReference": {
            return "".concat(ast.propertyName);
        }
        case "SelectionAll": {
            return "?[".concat(prettyPrint(ast.expression), "]");
        }
        case "SelectionFirst": {
            return "^[".concat(prettyPrint(ast.expression), "]");
        }
        case "SelectionLast": {
            return "$[".concat(prettyPrint(ast.expression), "]");
        }
        case "StringLiteral": {
            var escape_1 = function (str) { return str.replace("\"", "\"\""); };
            return /\r|\n/.exec(ast.value)
                ? "\"\"\"".concat(escape_1(ast.value), "\"\"\"")
                : "\"".concat(escape_1(ast.value), "\"");
        }
        case "Ternary": {
            return "".concat(maybeParen(ast.expression), " ? ").concat(maybeParen(ast.ifTrue), " : ").concat(maybeParen(ast.ifFalse));
        }
        case "VariableReference": {
            return "#".concat(ast.variableName);
        }
    }
};
export default prettyPrint;
//# sourceMappingURL=prettyPrint.js.map