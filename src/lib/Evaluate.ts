import { Ast } from "./Ast";
import { UnexpectedError } from "./CustomErrors";
import { compile as compileRegex } from "java-regex-js";

type Some<R = unknown> = {
  _tag: "some";
  isSome: true;
  value: R;
};
const some = <R = unknown>(value: R): Some<R> => ({
  _tag: "some",
  isSome: true,
  value,
});

const none = {
  _tag: "none",
  isSome: false,
} as const;

type None = typeof none;

type Maybe<R = unknown> = Some<R> | None;

const isSome = <R = unknown>(maybe: Maybe<R>): maybe is Some<R> => {
  return maybe._tag === "some";
};
const isNone = <R = unknown>(maybe: Maybe<R>): maybe is None => {
  return maybe._tag === "none";
};

const maybeFromUndefined = (value: unknown) => {
  if (typeof value === "undefined") {
    return none;
  }
  return some(value);
};

export type EvalOptions = {
  disableBoolOpChecks?: true;
};

export const getEvaluator = (
  rootContext: Record<string, unknown>,
  functionsAndVariables: Record<string, unknown>,
  options?: EvalOptions
) => {
  const disableBoolOpChecks = options?.disableBoolOpChecks ?? false;
  let stack: unknown[] = [rootContext]; // <- could be a class.
  const getHead = () => {
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
  const ixOfThisBeforeCompoundOpened = (() => {
    const _ix: number[] = [];
    return {
      pushCurrent: () => _ix.push(stack.length - 1),
      get: () => _ix[_ix.length - 1] ?? null,
      pop: () => _ix.pop(),
      hasSome: () => _ix.length > 0,
    };
  })();

  const getValueInProvidedFuncsAndVars = (variableName: string): Maybe => {
    if (variableName === "this") {
      return some(getHead());
    } else if (variableName === "root") {
      return some(stack[0]);
    } else {
      return maybeFromUndefined(functionsAndVariables[variableName]);
    }
  };
  const searchForPropertyValueInContextStack = (variable: string): Maybe => {
    return [...stack].reverse().reduce<Maybe>((prev, curr) => {
      if (isSome(prev)) {
        return prev;
      } else if (variable === "this") {
        return some(curr);
      } else if (curr !== null && typeof curr !== "undefined") {
        return maybeFromUndefined(curr[variable]);
      } else {
        return none;
      }
    }, none);
  };
  function binFloatOp<Out extends number | boolean>(
    op: (a: number, b: number) => Out
  );
  function binFloatOp<Out extends number | boolean>(
    op: (a: number, b: number) => Out,
    allowNull: false
  );
  function binFloatOp<Out extends number | boolean>(
    op: (a: number | null, b: number | null) => Out,
    allowNull: true
  );
  function binFloatOp<Out extends number | boolean>(
    op: (a: number | null, b: number | null) => Out,
    allowNull = false
  ) {
    return (_left: Ast, _right: Ast) => {
      const left = evaluate(_left);
      const right = evaluate(_right);
      if (
        typeof left !== "number" &&
        !(allowNull && (left === null || typeof left === "undefined"))
      ) {
        throw new Error(JSON.stringify(left) + " is not a float");
      }
      if (
        typeof right !== "number" &&
        !(allowNull && (right === null || typeof right === "undefined"))
      ) {
        throw new Error(JSON.stringify(right) + " is not a float");
      }
      return op(
        (left ?? null) as number | null,
        (right ?? null) as number | null
      );
    };
  }
  const binStringOp =
    <Out extends number | boolean>(op: (a: string, b: string) => Out) =>
    (_left: Ast, _right: Ast) => {
      const left = evaluate(_left);
      const right = evaluate(_right);
      if (typeof left !== "string") {
        throw new Error(JSON.stringify(left) + " is not a string");
      }
      if (typeof right !== "string") {
        throw new Error(JSON.stringify(right) + " is not a string");
      }
      return op(left, right);
    };
  const find = <E extends unknown>(
    array: E[],
    expression: Ast,
    reverse: boolean
  ) => {
    const value = reverse ? array.reverse() : array;
    const result = value.find((e) => {
      stack.push(e);
      const result = evaluate(expression);
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
  const evaluate = (
    ast: Ast,
    isCompound = false,
    isFirstInCompound = false
  ): unknown => {
    switch (ast.type) {
      case "BooleanLiteral":
        return ast.value;
      case "CompoundExpression": {
        ixOfThisBeforeCompoundOpened.pushCurrent();
        const res = ast.expressionComponents.reduce((_, curr, i) => {
          const isFirst = i === 0;
          const res = evaluate(curr, true, isFirst);
          stack.push(res);
          return res;
        }, rootContext);
        ast.expressionComponents.forEach(() => {
          stack.pop();
        });
        ixOfThisBeforeCompoundOpened.pop();
        return res;
      }
      case "Elvis": {
        const expr = evaluate(ast.expression);
        if (expr === null) {
          return evaluate(ast.ifFalse);
        } else {
          return expr;
        }
      }
      case "FunctionReference": {
        const maybeProvidedFunction = getValueInProvidedFuncsAndVars(
          ast.functionName
        );
        const evaluatedArguments = ast.args.map((arg) => evaluate(arg));
        if (isNone(maybeProvidedFunction)) {
          if (!ast.nullSafeNavigation) {
            throw new Error("Function " + ast.functionName + " not found.");
          } else {
            return null;
          }
        }
        const { value } = maybeProvidedFunction;
        if (typeof value !== "function") {
          throw new Error(
            "Variable " + ast.functionName + " is not a function."
          );
        }
        return value(...evaluatedArguments);
      }
      case "Indexer": {
        const head = getHead();
        if (head === null && ast.nullSafeNavigation) {
          return null;
        }
        const index = evaluate(ast.index);
        if (typeof head === "string" && typeof index === "number") {
          if (index >= 0 && index < head.length) {
            return head[index];
          }
          throw new Error(
            "index " +
              index +
              " is out of range on string " +
              JSON.stringify(head)
          );
        } else if (Array.isArray(head) && typeof index === "number") {
          if (index >= 0 && index < head.length) {
            return head[index];
          }
          throw new Error(
            "index " +
              index +
              " is out of range on array " +
              JSON.stringify(head)
          );
        } else if (
          head &&
          typeof head === "object" &&
          (typeof index === "string" || typeof index === "number")
        ) {
          if (Object.prototype.hasOwnProperty.call(head, index)) {
            return head[index];
          } else {
            return null;
          }
        }
        throw new Error(
          "Not supported: indexing into " +
            JSON.stringify(head) +
            " with " +
            JSON.stringify(index)
        );
      }
      case "InlineList": {
        return ast.elements.map((el) => evaluate(el));
      }
      case "InlineMap": {
        return Object.entries(ast.elements).reduce((prev, [k, v]) => {
          prev[k] = evaluate(v);
          return prev;
        }, {});
      }
      case "MethodReference": {
        const evaluateArg = (arg: Ast) => {
          if (!ixOfThisBeforeCompoundOpened.hasSome()) {
            return evaluate(arg);
          }
          // store the old stack, so we can put it back
          const storedStack = stack;
          // Now set a stack so #this points outside the head of our current compound expression
          stack = stack.slice(0, ixOfThisBeforeCompoundOpened.get() + 1);
          // evaluate with temporary stack
          const result = evaluate(arg);
          // put the stack back.
          stack = storedStack;
          return result;
        };
        if (ast.methodName === "length") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            return currentContext.length;
          }
        }
        if (ast.methodName === "matches") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const rx = evaluateArg(ast.args[0]);
            if (typeof rx !== "string") {
              throw new Error(
                "Cannot call 'string.matches()' with argument of type " +
                  typeof rx
              );
            }
            return compileRegex(rx)(currentContext);
          }
        }
        if (ast.methodName === "size") {
          const currentContext = getHead();
          if (Array.isArray(currentContext)) {
            return currentContext.length;
          }
        }
        if (ast.methodName === "contains") {
          const currentContext = getHead();
          if (Array.isArray(currentContext)) {
            return currentContext.includes(evaluateArg(ast.args[0]));
          }
        }
        const head = getHead();
        const valueInTopContext = head?.[ast.methodName];
        if (valueInTopContext) {
          const evaluatedArguments = ast.args.map((arg) => evaluateArg(arg)); // <- arguments are evaluated lazily
          if (typeof valueInTopContext === "function") {
            const boundFn = valueInTopContext.bind(head);
            return boundFn(...evaluatedArguments);
          }
        } else if (!ast.nullSafeNavigation) {
          throw new Error("Method " + ast.methodName + " not found.");
        }
        return null;
      }
      case "Negative": {
        const operand = evaluate(ast.value);
        if (typeof operand === "number") {
          return operand * -1;
        }
        throw new Error(
          "unary (-) operator applied to " + JSON.stringify(operand)
        );
      }
      case "NullLiteral": {
        return null;
      }
      case "NumberLiteral": {
        return ast.value;
      }
      case "OpAnd": {
        const left = evaluate(ast.left);
        if (!disableBoolOpChecks && typeof left !== "boolean") {
          throw new Error(JSON.stringify(left) + " is not a boolean");
        }
        if (!left) {
          return !!left;
        }
        const right = evaluate(ast.right);
        if (!disableBoolOpChecks && typeof right !== "boolean") {
          throw new Error(JSON.stringify(right) + " is not a boolean");
        }
        return !!right;
      }
      case "OpDivide": {
        return binFloatOp((a, b) => a / b)(ast.left, ast.right);
      }
      case "OpEQ": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        // boolean, number, string, null
        return left === right;
      }
      case "OpGE": {
        return binFloatOp((a, b) => a >= b, true)(ast.left, ast.right);
      }
      case "OpGT": {
        return binFloatOp((a, b) => a > b, true)(ast.left, ast.right);
      }
      case "OpLE": {
        return binFloatOp((a, b) => a <= b, true)(ast.left, ast.right);
      }
      case "OpLT": {
        return binFloatOp((a, b) => a < b, true)(ast.left, ast.right);
      }
      case "OpMatches": {
        return binStringOp((a, b) => compileRegex(b)(a))(ast.left, ast.right);
      }
      case "OpBetween": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        if (!Array.isArray(right) || right.length !== 2) {
          throw new Error(
            "Right operand for the between operator has to be a two-element list"
          );
        }
        const [firstValue, secondValue] = right;

        return firstValue <= left && left <= secondValue;
      }
      case "OpMinus": {
        return binFloatOp((a, b) => a - b)(ast.left, ast.right);
      }
      case "OpModulus": {
        return binFloatOp((a, b) => a % b)(ast.left, ast.right);
      }
      case "OpMultiply": {
        return binFloatOp((a, b) => a * b)(ast.left, ast.right);
      }
      case "OpNE": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        // boolean, number, string, null
        return left !== right;
      }
      case "OpNot": {
        const exp = evaluate(ast.expression);
        return !exp;
      }
      case "OpOr": {
        const left = evaluate(ast.left);

        if (!disableBoolOpChecks && typeof left !== "boolean") {
          throw new Error(JSON.stringify(left) + " is not a boolean");
        }
        if (left) {
          return !!left;
        }
        const right = evaluate(ast.right);
        if (!disableBoolOpChecks && typeof right !== "boolean") {
          throw new Error(JSON.stringify(right) + " is not a boolean");
        }
        return !!right;
      }
      case "OpPlus": {
        const left = evaluate(ast.left) ?? null;
        const right = evaluate(ast.right) ?? null;

        const isStringOrNumber = (
          value: unknown
        ): value is bigint | string | number | null => {
          return (
            typeof value == "bigint" ||
            typeof value === "string" ||
            typeof value === "number" ||
            value === null
          );
        };
        if (!isStringOrNumber(left)) {
          throw new Error(JSON.stringify(left) + " is not a string or number.");
        }
        if (!isStringOrNumber(right)) {
          throw new Error(
            JSON.stringify(right) + " is not a string or number."
          );
        }
        if (left === null && right === null) {
          throw new Error(
            "Operator + is not valid between operands null and null"
          );
        }
        if (left == null && typeof right === "number") {
          throw new Error(
            "Operator + is not valid between operands null and of type number"
          );
        }
        if (typeof left == "number" && right === null) {
          throw new Error(
            "Operator + is not valid between operands of type number and null"
          );
        }
        // any is because typescript is being unreasonable here
        return (left as any) + right;
      }
      case "OpPower": {
        return binFloatOp((a, b) => a ** b)(ast.base, ast.expression);
      }
      case "Projection": {
        const { nullSafeNavigation, expression } = ast;
        const head = getHead();
        if (head === null && nullSafeNavigation) {
          return null;
        }
        if (Array.isArray(head)) {
          return head.map((v) => {
            stack.push(v);
            const result = evaluate(expression);
            stack.pop();
            return result;
          });
        }
        if (head && typeof head === "object") {
          return Object.values(head).map((v) => {
            stack.push(v);
            const result = evaluate(expression);
            stack.pop();
            return result;
          });
        }
        throw new Error(
          "Cannot run expression on non-array " + JSON.stringify(head)
        );
      }
      case "PropertyReference": {
        const { nullSafeNavigation, propertyName } = ast;
        if (isCompound && !isFirstInCompound) {
          // we can only get the head.
          const head = getHead();
          if (typeof head[propertyName] === "undefined") {
            if (nullSafeNavigation) {
              return null;
            }
            throw new Error(
              "Null Pointer Exception: Property " +
                JSON.stringify(propertyName) +
                " not found in head (last position)" +
                " of context " +
                JSON.stringify(stack)
            );
          }
          return head[propertyName];
        }
        const valueInContext: Maybe<unknown> =
          searchForPropertyValueInContextStack(propertyName);
        if (isNone(valueInContext)) {
          if (nullSafeNavigation) {
            return null;
          }
          throw new Error(
            "Null Pointer Exception: Property " +
              JSON.stringify(propertyName) +
              " not found in context " +
              JSON.stringify(stack)
          );
        }
        return valueInContext.value;
      }
      case "SelectionAll": {
        const { nullSafeNavigation, expression } = ast;
        const head = getHead();
        if (head === null && nullSafeNavigation) {
          return null;
        }
        if (Array.isArray(head)) {
          return head.filter((v, i) => {
            stack.push(v);
            const result = evaluate(expression);
            stack.pop();
            if (disableBoolOpChecks) {
              return Boolean(result);
            }
            if (typeof result !== "boolean") {
              throw new Error(
                "Result " +
                  JSON.stringify(result) +
                  " at index " +
                  i +
                  " of selection expression is not Boolean"
              );
            }
            return result === true;
          });
        }
        if (head && typeof head === "object") {
          // pojo
          return Object.fromEntries(
            Object.entries(head).filter(([key, value], i) => {
              stack.push({ key, value });
              const result = evaluate(expression);
              stack.pop();
              if (disableBoolOpChecks) {
                return Boolean(result);
              }
              if (typeof result !== "boolean") {
                throw new Error(
                  "Result " +
                    JSON.stringify(result) +
                    " at index " +
                    i +
                    " of selection expression is not Boolean"
                );
              }
              return result === true;
            })
          );
        }
        throw new Error(
          "Cannot run selection expression on non-collection " +
            JSON.stringify(head)
        );
      }
      case "SelectionFirst": {
        const { nullSafeNavigation, expression } = ast;
        const head = getHead();
        if (head === null && nullSafeNavigation) {
          return null;
        }

        if (Array.isArray(head)) {
          return find(head, expression, false);
        }
        if (head && typeof head === "object") {
          const result = find(
            Object.entries(head).map(([key, value]) => ({ key, value })),
            expression,
            false
          );
          return result && { [result.key]: result.value };
        }
        throw new Error(
          "Cannot run selection expression on non-array " + JSON.stringify(head)
        );
      }
      case "SelectionLast": {
        const { nullSafeNavigation, expression } = ast;
        const head = getHead();
        if (head === null && nullSafeNavigation) {
          return null;
        }

        if (Array.isArray(head)) {
          return find(head, expression, true);
        }
        if (head && typeof head === "object") {
          const result = find(
            Object.entries(head).map(([key, value]) => ({ key, value })),
            expression,
            true
          );
          return result && { [result.key]: result.value };
        }
        throw new Error(
          "Cannot run selection expression on non-array " + JSON.stringify(head)
        );
      }
      case "StringLiteral": {
        return ast.value;
      }
      case "Ternary": {
        const { expression, ifTrue, ifFalse } = ast;
        const conditionResult = evaluate(expression);
        if (
          conditionResult === true ||
          (disableBoolOpChecks && Boolean(conditionResult))
        ) {
          return evaluate(ifTrue);
        } else if (conditionResult === false || conditionResult === null) {
          return evaluate(ifFalse);
        } else {
          throw new Error(
            "Unexpected non boolean/null in Ternary conditional expression: " +
              JSON.stringify(conditionResult)
          );
        }
      }
      case "VariableReference": {
        const valueInFuncsAndVars = getValueInProvidedFuncsAndVars(
          ast.variableName
        );
        if (isNone(valueInFuncsAndVars)) {
          throw new Error(
            "Null Pointer Exception: variable " +
              JSON.stringify(ast.variableName) +
              " not found"
          );
        }
        return valueInFuncsAndVars.value;
      }
    }
  };
  return (ast: Ast) => evaluate(ast);
};
