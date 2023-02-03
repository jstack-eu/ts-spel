import { Ast } from "./Ast";
import { ParsingError } from "./CustomErrors";
import _stringLiteral from "./stringLiteralSPELStyle";

// turn true for debugging.
const logFlag = false;

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
 * @returns AST representing input
 */

export const parse = function (input: string): Ast {
  let index = 0;

  const log = (...args) => {
    if (logFlag) {
      console.log(input.slice(index), ...args);
    }
  };

  const utils = {
    // s : 'a'  ==>  var s = function() { return char('a'); };
    char: function (expected: string): string | null {
      let c: string;
      return index < input.length && (c = input.charAt(index++)) === expected
        ? c
        : (() => {
            if (c && c !== expected) {
              index--;
            }
            return null;
          })();
    },
    chars: function (expected: string): string | null {
      const backtrack = index;
      let success = true;
      for (let i = 0; success && i < expected.length; i++) {
        success = Boolean(utils.char(expected[i]));
      }
      if (!success) {
        index = backtrack;
        return null;
      }
      return expected;
    },
    // s : /[0-9]+/  ==>  var s = function() { return regExp(/[0-9]+/); };
    regExp: function (regexp: RegExp): string | null {
      let match: RegExpMatchArray;
      if (
        index < input.length &&
        (match = regexp.exec(input.substr(index))) &&
        match.index === 0
      ) {
        index += match[0].length;
        return match[0];
      }
      return null;
    },

    // s : s1 | s2  ==>  var s = function() { return firstOf(s1, s2); };
    firstOf: function (...args: (() => null | Ast)[]) {
      const backtrack = index;
      for (let len = args.length, i = 0; i < len; i++) {
        const val = args[i]();
        if (val !== null) {
          return val;
        }
        index = backtrack;
      }
      return null;
    },
    // s : t*  ==>  s : s';  s' : t s' | empty  ==>  var s = function() { return zeroOrMore(t); };
    zeroOrMore: function (func: () => Ast | null) {
      for (;;) {
        const backtrack = index;
        if (!func()) {
          index = backtrack;
          return true;
        }
      }
    },
    whitSpc: function () {
      while (index < input.length && input.charAt(index).trim() === "") {
        index += 1;
      }
      return true;
    },
    identifier: function () {
      return utils.regExp(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    },
    stringLiteral: function (): string | null {
      const match = _stringLiteral(input.slice(index));
      if (match === -1) {
        throw new ParsingError(input, index, "Non-terminating quoted string");
      }
      if (match) {
        index = index + match[1];
        return match[0];
      }
      return null;
    },
  };

  const expression = function (): Ast | null {
    log("expression");
    utils.whitSpc();
    const exp1 = logicalOrExpression();
    utils.whitSpc();
    if (utils.char("?")) {
      if (utils.char(":")) {
        log("after elvis operator");
        const exp2 = expression();
        log("after expression eaten post elvis");
        if (!exp2) {
          throw new ParsingError(
            input,
            index,
            "Expected expression after elvis (?:)"
          );
        }
        return {
          type: "Elvis",
          expression: exp1,
          ifFalse: exp2,
        };
      } else {
        let exp2: Ast | null = null;
        let exp3: Ast | null = null;
        if ((exp2 = expression()) && utils.char(":") && (exp3 = expression())) {
          return {
            type: "Ternary",
            expression: exp1,
            ifTrue: exp2,
            ifFalse: exp3,
          };
        } else {
          throw new ParsingError(input, index, "Incomplete Ternary");
        }
      }
    } else {
      return exp1;
    }
  };

  const logicalOrExpression = function (): Ast | null {
    log("logicalOrExpression");
    utils.whitSpc();
    let left: Ast | null = logicalAndExpression();
    utils.whitSpc();
    utils.zeroOrMore(() => {
      utils.whitSpc();
      let right: Ast | null;
      if (utils.char("|")) {
        if (utils.char("|")) {
          if ((right = logicalAndExpression())) {
            left = {
              type: "OpOr",
              left,
              right,
            };
            return left;
          } else {
            throw new ParsingError(input, index, "No right operand for ||");
          }
        } else {
          throw new ParsingError(input, index, "Missing Character |");
        }
      }
      return null;
    });
    return left;
  };

  const logicalAndExpression = function (): Ast | null {
    log("logicalAndExpression");
    utils.whitSpc();
    let left: Ast | null = relationalExpression();
    utils.whitSpc();
    utils.zeroOrMore(() => {
      utils.whitSpc();
      let right: Ast | null;
      if (utils.char("&")) {
        if (utils.char("&")) {
          if ((right = relationalExpression())) {
            left = {
              type: "OpAnd",
              left,
              right,
            };
            return left;
          } else {
            throw new ParsingError(input, index, "No right operand for &&");
          }
        } else {
          throw new ParsingError(input, index, "Missing Character &");
        }
      }
      return null;
    });
    return left;
  };

  /*
  OPEQ NOT IMPLEMENTED!!
  */
  const relationalExpression = function (): Ast | null {
    log("relationalExpression");
    utils.whitSpc();
    const left: Ast | null = sumExpression();
    let right: Ast | null = null;
    const backtrack = index;
    utils.whitSpc();
    if (utils.char(">")) {
      if (utils.char("=")) {
        if ((right = sumExpression())) {
          return {
            type: "OpGE",
            left,
            right,
          };
        } else {
          throw new ParsingError(input, index, "No right operand for >=");
        }
      } else if ((right = sumExpression())) {
        return {
          type: "OpGT",
          left,
          right,
        };
      } else {
        throw new ParsingError(input, index, "No right operand for >");
      }
    } else if (utils.char("<")) {
      if (utils.char("=")) {
        if ((right = sumExpression())) {
          return {
            type: "OpLE",
            left,
            right,
          };
        } else {
          throw new ParsingError(input, index, "No right operand for <=");
        }
      } else if ((right = sumExpression())) {
        return {
          type: "OpLT",
          left,
          right,
        };
      } else {
        throw new ParsingError(input, index, "No right operand for <");
      }
    } else if (utils.char("!")) {
      if (utils.char("=")) {
        if ((right = sumExpression())) {
          return {
            type: "OpNE",
            left,
            right,
          };
        } else {
          throw new ParsingError(input, index, "No right operand for !=");
        }
      } else {
        index = backtrack;
      }
    } else if (utils.char("=")) {
      log("got =");
      if (utils.char("=")) {
        if ((right = sumExpression())) {
          return {
            type: "OpEQ",
            left,
            right,
          };
        } else {
          throw new ParsingError(input, index, "No right operand for ==");
        }
      } else {
        throw new ParsingError(input, index, "Assignment not allowed");
      }
    } else {
      let keyword = utils.identifier();
      if (keyword === "matches") {
        if ((right = sumExpression())) {
          return {
            type: "OpMatches",
            left,
            right,
          };
        } else {
          throw new ParsingError(
            input,
            index,
            "No right operand for 'matches'"
          );
        }
      } else if (keyword === "between") {
        if ((right = sumExpression())) {
          return {
            type: "OpBetween",
            left,
            right,
          };
        } else {
          throw new ParsingError(
            input,
            index,
            "No right operand for 'between'"
          );
        }
      } else if (keyword) {
        throw new ParsingError(
          input,
          index,
          "Not an Operator",
          `"${keyword}" is not an operator`
        );
      }
    }
    log("fell through");
    return left;
  };

  const sumExpression = function (): Ast | null {
    log("sumExpression");
    utils.whitSpc();
    let left: Ast | null = productExpression();
    utils.whitSpc();
    log("sumExpression left", left);
    utils.zeroOrMore(() => {
      utils.whitSpc();
      log("in zeroOrMore");
      let right: Ast | null = null;
      if (utils.char("+")) {
        log("pluscase");
        right = productExpression();
        left = {
          type: "OpPlus",
          left,
          right,
        };
        return left;
      } else if (utils.char("-")) {
        log("minuscase");
        right = productExpression();
        left = {
          type: "OpMinus",
          left,
          right,
        };
        return left;
      } else {
        log("missed all");
      }
      return null;
    });

    return left;
  };
  const productExpression = function (): Ast | null {
    log("productExpression");
    utils.whitSpc();
    let left: Ast | null = powerExpression();
    utils.whitSpc();
    utils.zeroOrMore(() => {
      let right: Ast | null = null;
      if (utils.char("*")) {
        if (!left) {
          throw new ParsingError(input, index - 1, "No left operand for *");
        }
        right = powerExpression();
        if (right) {
          left = {
            type: "OpMultiply",
            left,
            right,
          };
          return left;
        }
        throw new ParsingError(input, index, "No right operand for *");
      } else if (utils.char("/")) {
        if (!left) {
          throw new ParsingError(input, index - 1, "No left operand for /");
        }
        right = powerExpression();
        if (right) {
          left = {
            type: "OpDivide",
            left,
            right,
          };
          return left;
        }
        throw new ParsingError(input, index, "No right operand for /");
      } else if (utils.char("%")) {
        if (!left) {
          throw new ParsingError(input, index - 1, "No left operand for %");
        }
        right = powerExpression();
        if (right) {
          left = {
            type: "OpModulus",
            left,
            right,
          };
          return left;
        }
        throw new ParsingError(input, index, "No right operand for %");
      }
      return null;
    });
    return left;
  };
  const powerExpression = function (): Ast | null {
    log("powerExpression");
    utils.whitSpc();
    const left: Ast | null = unaryExpression();
    utils.whitSpc();
    const backtrack = index;
    if (utils.char("^")) {
      const right: Ast | null = unaryExpression();
      return {
        type: "OpPower",
        base: left,
        expression: right,
      };
    } else {
      index = backtrack;
    }
    return left;
  };
  const unaryExpression = function (): Ast | null {
    log("unaryExpression");
    return utils.firstOf(negative, not, primaryExpression);
  };
  const negative = function (): Ast | null {
    log("negative");
    let operand: Ast | null = null;
    if (utils.char("-") && (operand = unaryExpression())) {
      return {
        type: "Negative",
        value: operand,
      };
    }
    log("negative (null)");
    return null;
  };
  const not = function (): Ast | null {
    log("not");
    let operand: Ast | null = null;
    if (utils.char("!") && (operand = unaryExpression())) {
      return {
        type: "OpNot",
        expression: operand,
      };
    }
    return null;
  };
  const primaryExpression = function (): Ast | null {
    log("primaryExpression");
    utils.whitSpc();
    const sn: Ast | null = startNode();
    log("after startNode got");
    const continuations: Ast[] = [];
    utils.zeroOrMore(() => {
      let nextNode: Ast | null = null;
      if ((nextNode = node())) {
        continuations.push(nextNode);
        return nextNode;
      }
      return null;
    });
    if (continuations.length > 0) {
      return {
        type: "CompoundExpression",
        expressionComponents: [sn, ...continuations],
      };
    }
    return sn;
  };
  const startNode = function (): Ast | null {
    log("startNode");
    return utils.firstOf(
      parenExpression,
      literal,
      functionOrVar,
      () => methodOrProperty(false),
      inlineListOrMap
    );
  };
  const node = function (): Ast | null {
    log("node");
    return utils.firstOf(
      projection,
      selection,
      navProperty,
      indexExp,
      functionOrVar
    );
  };
  const navProperty = function (): Ast | null {
    log("navProperty");
    if (utils.char(".")) {
      return methodOrProperty(false);
    }
    const backtrack = index;
    if (utils.char("?") && utils.char(".")) {
      return methodOrProperty(true);
    } else {
      index = backtrack;
    }
    return null;
  };

  const indexExp = function (): Ast | null {
    log("indexExp");
    return utils.firstOf(nullSafeIndex, notNullSafeIndex);
  };
  const nullSafeIndex = function (): Ast | null {
    log("nullSafeIndex");
    const backtrack = index;
    let innerExpression: Ast | null = null;
    if (utils.char("?") && utils.char("[")) {
      if ((innerExpression = expression()) && utils.char("]")) {
        return {
          type: "Indexer",
          nullSafeNavigation: true,
          index: innerExpression,
        };
      } else {
        throw new ParsingError(input, index, "Unclosed [");
      }
    } else {
      index = backtrack;
    }
    return null;
  };
  const notNullSafeIndex = function (): Ast | null {
    log("notNullSafeIndex");
    const backtrack = index;
    let innerExpression: Ast | null = null;
    if (utils.char("[")) {
      if ((innerExpression = expression()) && utils.char("]")) {
        return {
          type: "Indexer",
          nullSafeNavigation: false,
          index: innerExpression,
        };
      } else {
        throw new ParsingError(input, index, "Unclosed [");
      }
    } else {
      index = backtrack;
    }
    return null;
  };
  const methodOrProperty = function (nullSafeNavigation: boolean): Ast | null {
    log("methodOrProperty");
    utils.whitSpc();
    const args: Ast[] = [];
    let ident: string | null = null;
    if ((ident = utils.identifier())) {
      const fnbacktrack = index;
      if (utils.char("(")) {
        if (
          utils.zeroOrMore(() => {
            const arg = expression();
            if (arg) {
              args.push(arg);
              utils.char(",");
              return arg;
            }
            return null;
          }) &&
          utils.char(")")
        ) {
          return {
            type: "MethodReference",
            nullSafeNavigation,
            methodName: ident,
            args,
          };
        } else {
          throw new ParsingError(input, index, "Unclosed method call");
        }
      } else {
        index = fnbacktrack;
        return {
          type: "PropertyReference",
          propertyName: ident,
          nullSafeNavigation,
        };
      }
    }
    return null;
  };
  const functionOrVar = function (): Ast | null {
    log("functionOrVar");
    utils.whitSpc();
    const args: Ast[] = [];
    let ident: string | null = null;
    if (utils.char("#") && (ident = utils.identifier())) {
      const fnbacktrack = index;
      if (utils.char("(")) {
        if (
          utils.zeroOrMore(() => {
            const arg = expression();
            if (arg) {
              args.push(arg);
              utils.char(",");
              return arg;
            }
            return null;
          }) &&
          utils.char(")")
        ) {
          return {
            type: "FunctionReference",
            nullSafeNavigation: false,
            functionName: ident,
            args,
          };
        } else {
          throw new ParsingError(input, index, "Unclosed function call");
        }
      } else {
        index = fnbacktrack;
        return {
          type: "VariableReference",
          variableName: ident,
        };
      }
    }
    return null;
  };
  const selection = function (): Ast | null {
    log("selection");
    utils.whitSpc();
    const backtrack = index;
    const nullSafeNavigation = (() => {
      if (utils.char("?")) {
        if (utils.char(".")) {
          return true;
        } else {
          index = backtrack;
          return null;
        }
      } else if (utils.char(".")) {
        return false;
      } else {
        return null;
      }
    })();
    log("nullSafeNavigation " + nullSafeNavigation);
    if (nullSafeNavigation === null) {
      return null;
    }

    const result = utils.firstOf(
      () => {
        let exp: Ast | null;
        if (utils.char("?") && utils.char("[")) {
          if (
            utils.whitSpc() &&
            (exp = expression()) &&
            utils.whitSpc() &&
            utils.char("]")
          ) {
            return {
              type: "SelectionAll",
              nullSafeNavigation,
              expression: exp,
            };
          } else {
            throw new ParsingError(
              input,
              index,
              "Unclosed Selection Expression ?["
            );
          }
        }
        return null;
      },
      () => {
        let exp: Ast | null;
        if (utils.char("^") && utils.char("[")) {
          if ((exp = expression()) && utils.char("]")) {
            return {
              type: "SelectionFirst",
              nullSafeNavigation,
              expression: exp,
            };
          } else {
            throw new ParsingError(
              input,
              index,
              "Unclosed SelectionFirst Expression ^["
            );
          }
        }
        return null;
      },
      () => {
        let exp: Ast | null;
        if (utils.char("$") && utils.char("[")) {
          if ((exp = expression()) && utils.char("]")) {
            return {
              type: "SelectionLast",
              nullSafeNavigation,
              expression: exp,
            };
          } else {
            throw new ParsingError(
              input,
              index,
              "Unclosed SelectionLast Expression $["
            );
          }
        }
        return null;
      }
    );
    if (result === null) {
      index = backtrack;
      return null;
    }
    return result;
  };
  const projection = function (): Ast | null {
    log("projection");
    utils.whitSpc();
    const backtrack = index;
    const nullSafeNavigation = (() => {
      if (utils.char("?")) {
        if (utils.char(".")) {
          return true;
        } else {
          index = backtrack;
          return null;
        }
      } else if (utils.char(".")) {
        return false;
      } else {
        return null;
      }
    })();
    if (nullSafeNavigation === null) {
      return null;
    }
    let exp: Ast | null;
    if (utils.char("!") && utils.char("[")) {
      if ((exp = expression()) && utils.char("]")) {
        return {
          type: "Projection",
          nullSafeNavigation,
          expression: exp,
        };
      } else {
        throw new ParsingError(
          input,
          index,
          "Unclosed Projection Expression !["
        );
      }
    } else {
      index = backtrack;
    }
    return null;
  };
  const literal = function (): Ast | null {
    log("literal");
    return utils.firstOf(
      () => {
        const stringLiteral = utils.stringLiteral();
        if (typeof stringLiteral === "string") {
          log("returning stringLiteral", stringLiteral);
          return {
            type: "StringLiteral",
            value: stringLiteral,
          };
        }
        return null;
      },
      number,
      () =>
        utils.chars("true") && {
          type: "BooleanLiteral",
          value: true,
        },
      () =>
        utils.chars("false") && {
          type: "BooleanLiteral",
          value: false,
        },
      () =>
        utils.chars("null") && {
          type: "NullLiteral",
        }
    );
  };
  const parenExpression = function (): Ast | null {
    log("parenExpression");
    let exp: Ast | null;
    if (utils.char("(")) {
      if ((exp = expression()) && utils.char(")")) {
        return exp;
      }
      throw new ParsingError(input, index, "Unclosed Paren");
    }
    return null;
  };

  const inlineListOrMap = function (): Ast | null {
    log("inlineListOrMap");
    const listElements: Ast[] = [];
    const dict: {
      [key: string]: Ast;
    } = {};
    utils.whitSpc();
    if (utils.char("{")) {
      const fnbacktrack = index;
      // look for comma seperated list items
      if (
        utils.zeroOrMore(() => {
          const elem = expression();
          if (elem) {
            listElements.push(elem);
            utils.char(",");
            utils.whitSpc();
            return elem;
          }
          return null;
        }) &&
        utils.char("}")
      ) {
        return {
          type: "InlineList",
          elements: listElements,
        };
      } else {
        index = fnbacktrack;
      }
      // look for dictionary key/value pairs
      if (
        utils.zeroOrMore(() => {
          utils.whitSpc();
          let ident: string | null;
          let elem: Ast | null;
          if (
            (ident = utils.identifier()) &&
            utils.char(":") &&
            (elem = expression())
          ) {
            dict[ident] = elem;
            utils.char(",");
            return elem;
          }
          return null;
        }) &&
        utils.whitSpc() &&
        utils.char("}")
      ) {
        return {
          type: "InlineMap",
          elements: dict,
        };
      } else {
        index = fnbacktrack;
      }
      throw new ParsingError(input, index, "Unclosed {");
    }
    return null;
  };

  // number : /\d+(?:\.\d+)?/
  const number = function (): Ast | null {
    utils.whitSpc();
    const str = utils.regExp(/\d+(?:\.\d+)?/);
    if (str) {
      return {
        type: "NumberLiteral",
        value: parseFloat(str),
      };
    }
    return null;
  };

  const result = expression();
  if (index !== input.length) {
    throw new ParsingError(input, index, "Expression Remaining");
  }
  if (result === null) {
    throw new ParsingError(input, index, "Generic");
  }
  return result;
};
