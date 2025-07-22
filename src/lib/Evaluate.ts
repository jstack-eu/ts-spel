import { Ast } from "./Ast";
import { UnexpectedError } from "./CustomErrors";
import { compile as compileRegex } from "java-regex-js";
import JSOG from "jsog";
import { SecurityWhitelist, WhitelistConfig } from "./SecurityWhitelist";
import { RegexValidator, safeCompileRegex } from "./RegexValidator";

const stringify = (obj: unknown) => {
  try {
    //if value is date, return date string
    if(obj instanceof Date) {
      return obj.toISOString();
    }
    return JSON.stringify(obj);
  } catch (e) {
    if (e.message.startsWith("Converting circular structure to JSON")) {
      return JSON.stringify(JSON.parse(JSOG.stringify(obj)), null, 2);
    }
    throw e;
  }
};

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
  disableNullPointerExceptions?: true;
  fallbackToFunctions?: true; // if a method in context wasn't found, look up in 'functionsAndVariables'
  fallbackToVariables?: true; // if a property in context wasn't found, look up in 'functionsAndVariables'
  // Security features are now always enabled and not configurable
};

export const getEvaluator = (
  rootContext: Record<string, unknown>,
  functionsAndVariables:
    | Record<string, unknown>
    | Array<Record<string, unknown>>,
  options?: EvalOptions
) => {
  const disableBoolOpChecks = options?.disableBoolOpChecks ?? false;
  const disableNullPointerExceptions =
    options?.disableNullPointerExceptions ?? false;
  const fallbackToFunctions = options?.fallbackToFunctions ?? false;
  const fallbackToVariables = options?.fallbackToVariables ?? false;
  
  // Security features are always enabled and non-configurable
  const { createDefaultWhitelist } = require("./SecurityWhitelist");
  const whitelist: SecurityWhitelist = createDefaultWhitelist();
  
  const { defaultRegexValidator } = require("./RegexValidator");
  const regexValidator: RegexValidator = defaultRegexValidator;
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
      if (Array.isArray(functionsAndVariables)) {
        for (let i = 0; i < functionsAndVariables.length; i++) {
          if (Object.prototype.hasOwnProperty.call(functionsAndVariables[i], variableName)) {
            const res = functionsAndVariables[i][variableName];
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
  const searchForPropertyValueInContextStack = (variable: string): Maybe => {
    return [...stack].reverse().reduce<Maybe>((prev, curr) => {
      if (isSome(prev)) {
        return prev;
      } else if (variable === "this") {
        return some(curr);
      } else if (curr !== null && typeof curr !== "undefined") {
        // Use safe property access to prevent prototype pollution
        if (Object.prototype.hasOwnProperty.call(curr, variable)) {
          return maybeFromUndefined(curr[variable]);
        }
        return none;
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
    return (left: unknown, right: unknown) => {
      // Convert Date objects to timestamps
      const convertToNumber = (val: unknown): unknown => {
        if (val instanceof Date) {
          return val.getTime();
        }
        return val;
      };
      
      const leftConverted = convertToNumber(left);
      const rightConverted = convertToNumber(right);
      
      if (
        typeof leftConverted !== "number" &&
        !(allowNull && (leftConverted === null || typeof leftConverted === "undefined"))
      ) {
        throw new Error(stringify(left) + " is not a float");
      }
      if (
        typeof rightConverted !== "number" &&
        !(allowNull && (rightConverted === null || typeof rightConverted === "undefined"))
      ) {
        throw new Error(stringify(right) + " is not a float");
      }
      return op(
        (leftConverted ?? null) as number | null,
        (rightConverted ?? null) as number | null
      );
    };
  }
  const binStringOp =
    <Out extends number | boolean>(op: (a: string, b: string) => Out) =>
    (left: unknown, right: unknown) => {
      // Allow strings, numbers, and safe objects for comparison operations
      const isValidType = (val: unknown) => {
        return typeof val === "string" || typeof val === "number" || 
               (val && typeof val === "object" && (val as any).constructor === Object);
      };
      if (!isValidType(left)) {
        throw new Error(stringify(left) + " is not a valid type for string operation");
      }
      if (!isValidType(right)) {
        throw new Error(stringify(right) + " is not a valid type for string operation");
      }
      return op(left as string, right as string);
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
        // Check if this compound expression exceeds property chain depth
        const propertyReferenceCount = ast.expressionComponents.filter(
          component => component.type === "PropertyReference"
        ).length;
        
        if (propertyReferenceCount > 10) { // Default max depth
          throw new Error(`Security violation: Maximum property chain depth exceeded: ${propertyReferenceCount} (max: 10)`);
        }
        
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
        // Handle T(java.lang.Math) static calls
        if (ast.functionName === "T" && ast.args.length === 1) {
          let staticClass: string | null = null;
          const arg = ast.args[0];
          
          // Handle different argument types
          if (arg.type === "StringLiteral") {
            // T('java.lang.Math') - string literal
            staticClass = arg.value;
          } else if (arg.type === "CompoundExpression") {
            // T(java.lang.Math) - compound expression of property references
            // Reconstruct the class name from property references
            const parts: string[] = [];
            for (const component of arg.expressionComponents) {
              if (component.type === "PropertyReference") {
                parts.push(component.propertyName);
              } else {
                // If it's not all property references, fall back to evaluation
                staticClass = evaluate(arg) as string;
                break;
              }
            }
            if (parts.length > 0 && staticClass === null) {
              staticClass = parts.join('.');
            }
          } else {
            // For other types, evaluate normally
            staticClass = evaluate(arg) as string;
          }
          
          if (staticClass === "java.lang.Math") {
            whitelist.enterCall();
            // Return a Math proxy object that allows method calls
            const mathProxy = {
              min: (...args: number[]) => Math.min(...args),
              max: (...args: number[]) => Math.max(...args),
              abs: (value: number) => Math.abs(value),
              round: (value: number) => Math.round(value),
              floor: (value: number) => Math.floor(value),
              ceil: (value: number) => Math.ceil(value),
              sqrt: (value: number) => Math.sqrt(value),
              pow: (base: number, exponent: number) => Math.pow(base, exponent),
              // Mark this as a trusted Math proxy
              __isMathProxy: true
            };
            whitelist.exitCall();
            return mathProxy;
          }
          
          if (staticClass === "eu.jstack.jflow.core.operators.FlowUtils") {
            whitelist.enterCall();
            // Return a FlowUtils proxy object that allows method calls
            const flowUtilsProxy = {
              date: (dateString: string) => {
                // Parse date string to Date object
                if (typeof dateString !== 'string') {
                  throw new Error(`FlowUtils.date() requires a string argument, got ${typeof dateString}`);
                }
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {
                  throw new Error(`FlowUtils.date() received invalid date string: ${dateString}`);
                }
                return date;
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
        } catch (error) {
          throw new Error(`Security violation: ${error.message}`);
        }
        
        const maybeProvidedFunction = getValueInProvidedFuncsAndVars(
          ast.functionName
        );
        const evaluatedArguments = ast.args.map((arg) => evaluate(arg));
        if (isNone(maybeProvidedFunction)) {
          whitelist.exitCall();
          if (!ast.nullSafeNavigation) {
            throw new Error("Function " + ast.functionName + " not found.");
          } else {
            return null;
          }
        }
        const { value } = maybeProvidedFunction;
        if (typeof value !== "function") {
          whitelist.exitCall();
          throw new Error(
            "Variable " + ast.functionName + " is not a function."
          );
        }
        
        try {
          const result = value(...evaluatedArguments);
          whitelist.exitCall();
          return result;
        } catch (error) {
          whitelist.exitCall();
          throw error;
        }
      }
      case "Indexer": {
        const head = getHead();
        if (head === null && ast.nullSafeNavigation) {
          return null;
        }
        const index = ixOfThisBeforeCompoundOpened.hasSome()
          ? (() => {
              /**
               * when a property is used in an index, it's looking backwards through the stack we built up _for the compound_, not the stack _outside the current compound_
               * To do this properly, we need to track the stack _outside the current compound (of which [ ] is a part in the chain).
               * This index, which tracks the stack _outside_ the current compound, is 'ixOfThisBeforeCompoundOpened'
               *
               */

              // store the old stack, so we can put it back
              const storedStack = stack;
              // Now set a stack so #this points outside the head of our current compound expression
              stack = stack.slice(0, ixOfThisBeforeCompoundOpened.get() + 1);
              // evaluate with temporary stack
              const result = evaluate(ast.index);
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
          } catch (error) {
            whitelist.exitPropertyChain();
            throw new Error(`Security violation: ${error.message}`);
          }
        }
        if (typeof head === "string" && typeof index === "number") {
          if (index >= 0 && index < head.length) {
            return head[index];
          }
          throw new Error(
            "index " + index + " is out of range on string " + stringify(head)
          );
        } else if (Array.isArray(head) && typeof index === "number") {
          if (index >= 0 && index < head.length) {
            return head[index];
          }
          throw new Error(
            "index " + index + " is out of range on array " + stringify(head)
          );
        } else if (
          head &&
          typeof head === "object" &&
          (typeof index === "string" || typeof index === "number")
        ) {
          if (Object.prototype.hasOwnProperty.call(head, index)) {
            const result = head[index];
            if (typeof index === "string") {
              whitelist.exitPropertyChain();
            }
            return result;
          } else {
            if (typeof index === "string") {
              whitelist.exitPropertyChain();
            }
            return null;
          }
        }
        if (typeof index === "string") {
          whitelist.exitPropertyChain();
        }
        throw new Error(
          "Not supported: indexing into " +
            stringify(head) +
            " with " +
            stringify(index)
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
        // Check whitelist for method access
        const head = getHead();
        
        // Global math functions don't need context validation
        const globalMathFunctions = new Set(['MIN', 'MAX', 'ABS', 'ROUND', 'FLOOR', 'CEIL', 'DOUBLE', 'T']);
        
        // Check if this is a Math proxy object (from T(java.lang.Math))
        const isMathProxy = head && typeof head === 'object' && (head as any).__isMathProxy;
        
        // Check if this is a FlowUtils proxy object (from T(eu.jstack.jflow.core.operators.FlowUtils))
        const isFlowUtilsProxy = head && typeof head === 'object' && (head as any).__isFlowUtilsProxy;
        
        if (!globalMathFunctions.has(ast.methodName) && !isMathProxy && !isFlowUtilsProxy) {
          try {
            whitelist.validateMethodCall(head, ast.methodName);
            whitelist.enterCall();
          } catch (error) {
            throw new Error(`Security violation: ${error.message}`);
          }
        } else {
          // For global math functions, just enter call tracking
          whitelist.enterCall();
        }
        
        const evaluateArg = (arg: Ast) => {
          if (
            // no index of a currently opened compound expression has been found
            !ixOfThisBeforeCompoundOpened.hasSome() ||
            // it's just the method call (e.g. foo()) with nothing before it - the current head is actually what we want
            // (this happens when a.![foo(curr)])
            // - this check that we aren't in a currently opened compound chain prevents the head (a[0] for example) from being popped off.
            !isCompound
          ) {
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
            whitelist.exitCall();
            return currentContext.length;
          }
        }
        // JavaScript string methods
        if (ast.methodName === "endsWith") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const searchString = evaluateArg(ast.args[0]);
            if (typeof searchString !== "string") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.endsWith()' with argument of type " +
                  typeof searchString
              );
            }
            const position = ast.args[1] ? evaluateArg(ast.args[1]) : undefined;
            whitelist.exitCall();
            return currentContext.endsWith(searchString, typeof position === "number" ? position : undefined);
          }
        }
        if (ast.methodName === "startsWith") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const searchString = evaluateArg(ast.args[0]);
            if (typeof searchString !== "string") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.startsWith()' with argument of type " +
                  typeof searchString
              );
            }
            const position = ast.args[1] ? evaluateArg(ast.args[1]) : undefined;
            whitelist.exitCall();
            return currentContext.startsWith(searchString, typeof position === "number" ? position : undefined);
          }
        }
        if (ast.methodName === "includes") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const searchString = evaluateArg(ast.args[0]);
            if (typeof searchString !== "string") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.includes()' with argument of type " +
                  typeof searchString
              );
            }
            const position = ast.args[1] ? evaluateArg(ast.args[1]) : undefined;
            whitelist.exitCall();
            return currentContext.includes(searchString, typeof position === "number" ? position : undefined);
          }
        }
        if (ast.methodName === "indexOf") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const searchString = evaluateArg(ast.args[0]);
            if (typeof searchString !== "string") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.indexOf()' with argument of type " +
                  typeof searchString
              );
            }
            const position = ast.args[1] ? evaluateArg(ast.args[1]) : undefined;
            whitelist.exitCall();
            return currentContext.indexOf(searchString, typeof position === "number" ? position : undefined);
          }
        }
        if (ast.methodName === "lastIndexOf") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const searchString = evaluateArg(ast.args[0]);
            if (typeof searchString !== "string") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.lastIndexOf()' with argument of type " +
                  typeof searchString
              );
            }
            const position = ast.args[1] ? evaluateArg(ast.args[1]) : undefined;
            whitelist.exitCall();
            return currentContext.lastIndexOf(searchString, typeof position === "number" ? position : undefined);
          }
        }
        if (ast.methodName === "toLowerCase") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            whitelist.exitCall();
            return currentContext.toLowerCase();
          }
        }
        if (ast.methodName === "toUpperCase") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            whitelist.exitCall();
            return currentContext.toUpperCase();
          }
        }
        if (ast.methodName === "trim") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            whitelist.exitCall();
            return currentContext.trim();
          }
        }
        if (ast.methodName === "substring") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const start = evaluateArg(ast.args[0]);
            if (typeof start !== "number") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.substring()' with start argument of type " +
                  typeof start
              );
            }
            const end = ast.args[1] ? evaluateArg(ast.args[1]) : undefined;
            if (end !== undefined && typeof end !== "number") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.substring()' with end argument of type " +
                  typeof end
              );
            }
            whitelist.exitCall();
            return currentContext.substring(start, end as number | undefined);
          }
        }
        if (ast.methodName === "substr") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const start = evaluateArg(ast.args[0]);
            if (typeof start !== "number") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.substr()' with start argument of type " +
                  typeof start
              );
            }
            const length = ast.args[1] ? evaluateArg(ast.args[1]) : undefined;
            if (length !== undefined && typeof length !== "number") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.substr()' with length argument of type " +
                  typeof length
              );
            }
            whitelist.exitCall();
            return currentContext.substr(start, length as number | undefined);
          }
        }
        if (ast.methodName === "matches") {
          const currentContext = getHead();
          if (typeof currentContext === "string") {
            const rx = evaluateArg(ast.args[0]);
            if (typeof rx !== "string") {
              whitelist.exitCall();
              throw new Error(
                "Cannot call 'string.matches()' with argument of type " +
                  typeof rx
              );
            }
            whitelist.exitCall();
            // Use safe regex compilation with validation
            try {
              return safeCompileRegex(rx, regexValidator)(currentContext);
            } catch (error) {
              throw new Error(`Regex validation failed: ${error.message}`);
            }
          }
        }
        if (ast.methodName === "size") {
          const currentContext = getHead();
          if (Array.isArray(currentContext)) {
            whitelist.exitCall();
            return currentContext.length;
          }
        }
        if (ast.methodName === "isEmpty") {
          const currentContext = getHead();
          if (Array.isArray(currentContext)) {
            whitelist.exitCall();
            return currentContext.length === 0;
          }
        }
        if (ast.methodName === "get") {
          const currentContext = getHead();
          const rx = evaluateArg(ast.args[0]);
          
          // Validate property access for security
          if (typeof rx === "string") {
            try {
              whitelist.validatePropertyAccess(rx);
              whitelist.validateObjectAccess(currentContext);
            } catch (error) {
              whitelist.exitCall();
              throw new Error(`Security violation in get(): ${error.message}`);
            }
          }
          
          whitelist.exitCall();
          return currentContext?.[rx as keyof typeof currentContext];
        }
        if (ast.methodName === "add") {
          const currentContext = getHead();
          const rx = evaluateArg(ast.args[0]);
          
          // Validate input to prevent prototype pollution
          if (rx && typeof rx === "object") {
            if ((rx as any).constructor !== Object && (rx as any).constructor !== Array) {
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
          return [...(currentContext as any[]), rx];
        }
        if (ast.methodName === "contains") {
          const currentContext = getHead();
          if (Array.isArray(currentContext)) {
            const result = currentContext.includes(evaluateArg(ast.args[0]));
            whitelist.exitCall();
            return result;
          }
        }
        // Global math functions that work without context
        if (ast.methodName === "MIN") {
          const args = ast.args.map((arg) => evaluateArg(arg));
          if (args.length === 0) {
            whitelist.exitCall();
            throw new Error("MIN function requires at least one argument");
          }
          // Validate all arguments are numbers
          for (const arg of args) {
            if (typeof arg !== "number") {
              whitelist.exitCall();
              throw new Error(`MIN function argument must be a number, got ${typeof arg}`);
            }
          }
          whitelist.exitCall();
          return Math.min(...(args as number[]));
        }
        if (ast.methodName === "MAX") {
          const args = ast.args.map((arg) => evaluateArg(arg));
          if (args.length === 0) {
            whitelist.exitCall();
            throw new Error("MAX function requires at least one argument");
          }
          // Validate all arguments are numbers
          for (const arg of args) {
            if (typeof arg !== "number") {
              whitelist.exitCall();
              throw new Error(`MAX function argument must be a number, got ${typeof arg}`);
            }
          }
          whitelist.exitCall();
          return Math.max(...(args as number[]));
        }
        if (ast.methodName === "ABS") {
          const args = ast.args.map((arg) => evaluateArg(arg));
          if (args.length !== 1) {
            whitelist.exitCall();
            throw new Error("ABS function requires exactly one argument");
          }
          if (typeof args[0] !== "number") {
            whitelist.exitCall();
            throw new Error(`ABS function argument must be a number, got ${typeof args[0]}`);
          }
          whitelist.exitCall();
          return Math.abs(args[0]);
        }
        if (ast.methodName === "ROUND") {
          const args = ast.args.map((arg) => evaluateArg(arg));
          if (args.length < 1 || args.length > 2) {
            whitelist.exitCall();
            throw new Error("ROUND function requires 1 or 2 arguments (value, precision)");
          }
          if (typeof args[0] !== "number") {
            whitelist.exitCall();
            throw new Error(`ROUND function value must be a number, got ${typeof args[0]}`);
          }
          
          // Default precision is 0 (round to integer)
          const precision = args.length === 2 ? args[1] : 0;
          if (typeof precision !== "number" || !Number.isInteger(precision)) {
            whitelist.exitCall();
            throw new Error(`ROUND function precision must be an integer, got ${typeof precision}`);
          }
          
          whitelist.exitCall();
          
          // Handle precision rounding
          if (precision === 0) {
            return Math.round(args[0]);
          } else {
            const factor = Math.pow(10, precision);
            return Math.round(args[0] * factor) / factor;
          }
        }
        if (ast.methodName === "FLOOR") {
          const args = ast.args.map((arg) => evaluateArg(arg));
          if (args.length !== 1) {
            whitelist.exitCall();
            throw new Error("FLOOR function requires exactly one argument");
          }
          if (typeof args[0] !== "number") {
            whitelist.exitCall();
            throw new Error(`FLOOR function argument must be a number, got ${typeof args[0]}`);
          }
          whitelist.exitCall();
          return Math.floor(args[0]);
        }
        if (ast.methodName === "CEIL") {
          const args = ast.args.map((arg) => evaluateArg(arg));
          if (args.length !== 1) {
            whitelist.exitCall();
            throw new Error("CEIL function requires exactly one argument");
          }
          if (typeof args[0] !== "number") {
            whitelist.exitCall();
            throw new Error(`CEIL function argument must be a number, got ${typeof args[0]}`);
          }
          whitelist.exitCall();
          return Math.ceil(args[0]);
        }
        if (ast.methodName === "DOUBLE") {
          const args = ast.args.map((arg) => evaluateArg(arg));
          if (args.length !== 1) {
            whitelist.exitCall();
            throw new Error("DOUBLE function requires exactly one argument");
          }
          whitelist.exitCall();
          return parseFloat(args[0] as any);
        }
        // T() static class access - handle as method
        if (ast.methodName === "T") {
          if (ast.args.length !== 1) {
            whitelist.exitCall();
            throw new Error("T function requires exactly one argument (class name)");
          }
          
          let staticClass: string | null = null;
          const arg = ast.args[0];
          
          // Handle different argument types
          if (arg.type === "StringLiteral") {
            // T('java.lang.Math') - string literal
            staticClass = arg.value;
          } else if (arg.type === "CompoundExpression") {
            // T(java.lang.Math) - compound expression of property references
            // Reconstruct the class name from property references
            const parts: string[] = [];
            for (const component of arg.expressionComponents) {
              if (component.type === "PropertyReference") {
                parts.push(component.propertyName);
              } else {
                // If it's not all property references, fall back to evaluation
                staticClass = evaluateArg(arg) as string;
                break;
              }
            }
            if (parts.length > 0 && staticClass === null) {
              staticClass = parts.join('.');
            }
          } else {
            // For other types, evaluate normally
            staticClass = evaluateArg(arg) as string;
          }
          
          if (staticClass === "java.lang.Math") {
            // Return a Math proxy object that allows method calls
            const mathProxy = {
              min: (...mathArgs: number[]) => Math.min(...mathArgs),
              max: (...mathArgs: number[]) => Math.max(...mathArgs),
              abs: (value: number) => Math.abs(value),
              round: (value: number) => Math.round(value),
              floor: (value: number) => Math.floor(value),
              ceil: (value: number) => Math.ceil(value),
              sqrt: (value: number) => Math.sqrt(value),
              pow: (base: number, exponent: number) => Math.pow(base, exponent),
              // Mark this as a trusted Math proxy
              __isMathProxy: true
            };
            whitelist.exitCall();
            return mathProxy;
          }
          
          if (staticClass === "eu.jstack.jflow.core.operators.FlowUtils") {
            // Return a FlowUtils proxy object that allows method calls
            const flowUtilsProxy = {
              date: (dateString: string) => {
                // Parse date string to Date object
                if (typeof dateString !== 'string') {
                  whitelist.exitCall();
                  throw new Error(`FlowUtils.date() requires a string argument, got ${typeof dateString}`);
                }
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {
                  whitelist.exitCall();
                  throw new Error(`FlowUtils.date() received invalid date string: ${dateString}`);
                }
                return date;
              },
              // Mark this as a trusted FlowUtils proxy
              __isFlowUtilsProxy: true
            };
            whitelist.exitCall();
            return flowUtilsProxy;
          }
          
          whitelist.exitCall();
          throw new Error(`Unsupported static class: ${staticClass}`);
        }
        // Safe property access for method lookup
        const valueInTopContext = head && Object.prototype.hasOwnProperty.call(head, ast.methodName) 
          ? head[ast.methodName] 
          : undefined;
        if (valueInTopContext) {
          const evaluatedArguments = ast.args.map((arg) => evaluateArg(arg)); // <- arguments are evaluated lazily
          if (typeof valueInTopContext === "function") {
            const boundFn = valueInTopContext.bind(head);
            try {
              const result = boundFn(...evaluatedArguments);
              whitelist.exitCall();
              return result;
            } catch (error) {
              whitelist.exitCall();
              throw error;
            }
          }
        }
        if (fallbackToFunctions) {
          // method wasn't found - let's look in functions and variables
          const entryInFunctionsAndVariables = getValueInProvidedFuncsAndVars(
            ast.methodName
          );
          if (
            entryInFunctionsAndVariables.isSome &&
            typeof entryInFunctionsAndVariables.value === "function"
          ) {
            const evaluatedArguments = ast.args.map((arg) => evaluateArg(arg));
            try {
              const result = entryInFunctionsAndVariables.value(...evaluatedArguments);
              whitelist.exitCall();
              return result;
            } catch (error) {
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
        const operand = evaluate(ast.value);
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
        const left = evaluate(ast.left);
        if (!disableBoolOpChecks && typeof left !== "boolean") {
          throw new Error(stringify(left) + " is not a boolean");
        }
        if (!left) {
          return !!left;
        }
        const right = evaluate(ast.right);
        if (!disableBoolOpChecks && typeof right !== "boolean") {
          throw new Error(stringify(right) + " is not a boolean");
        }
        return !!right;
      }
      case "OpDivide": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        return binFloatOp((a, b) => a / b)(left, right);
      }
      case "OpEQ": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        // boolean, number, string, null
        return left === right;
      }
      case "OpGE": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
          return binStringOp((a, b) => a >= b)(left, right);
        }
        return binFloatOp((a, b) => a >= b, true)(left, right);
      }
      case "OpGT": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
          return binStringOp((a, b) => a > b)(left, right);
        }
        return binFloatOp((a, b) => a > b, true)(left, right);
      }
      case "OpLE": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
          return binStringOp((a, b) => a <= b)(left, right);
        }
        return binFloatOp((a, b) => a <= b, true)(left, right);
      }
      case "OpLT": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
          return binStringOp((a, b) => a < b)(left, right);
        }
        return binFloatOp((a, b) => a < b, true)(left, right);
      }
      case "OpMatches": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        return binStringOp((a, b) => {
          // Use safe regex compilation with validation
          try {
            return safeCompileRegex(b, regexValidator)(a);
          } catch (error) {
            throw new Error(`Regex validation failed: ${error.message}`);
          }
        })(left, right);
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
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        return binFloatOp((a, b) => a - b)(left, right);
      }
      case "OpModulus": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        return binFloatOp((a, b) => a % b)(left, right);
      }
      case "OpMultiply": {
        const left = evaluate(ast.left);
        const right = evaluate(ast.right);
        return binFloatOp((a, b) => a * b)(left, right);
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
          throw new Error(stringify(left) + " is not a boolean");
        }
        if (left) {
          return !!left;
        }
        const right = evaluate(ast.right);
        if (!disableBoolOpChecks && typeof right !== "boolean") {
          throw new Error(stringify(right) + " is not a boolean");
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
          throw new Error(stringify(left) + " is not a string or number.");
        }
        if (!isStringOrNumber(right)) {
          throw new Error(stringify(right) + " is not a string or number.");
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
        const base = evaluate(ast.base);
        const expression = evaluate(ast.expression);
        return binFloatOp((a, b) => a ** b)(base, expression);
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
          return Object.entries(head).map(([key, value]) => {
            stack.push({ key, value });
            const result = evaluate(expression);
            stack.pop();
            return result;
          });
        }
        throw new Error(
          "Cannot run expression on non-array " + stringify(head)
        );
      }
      case "PropertyReference": {
        const { nullSafeNavigation, propertyName } = ast;
        
        // Track property chain depth to prevent uncontrolled traversal
        try {
          whitelist.enterPropertyChain();
          whitelist.validatePropertyAccess(propertyName);
        } catch (error) {
          whitelist.exitPropertyChain();
          throw new Error(`Security violation: ${error.message}`);
        }
        
        if (isCompound && !isFirstInCompound) {
          // we can only get the head.
          const head = getHead();
          if (head === null || typeof head === "undefined") {
            whitelist.exitPropertyChain();
            if (nullSafeNavigation || disableNullPointerExceptions) {
              return null;
            }
            throw new Error(
              `Cannot chain property "${propertyName}" off of ${
                head === null ? "null" : "undefined"
              }`
            );
          }

          // Validate object access for sensitive object detection
          try {
            whitelist.validateObjectAccess(head);
          } catch (error) {
            whitelist.exitPropertyChain();
            throw new Error(`Security violation: ${error.message}`);
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
              const res = getValueInProvidedFuncsAndVars(propertyName);
              if (res.isSome) {
                return res.value;
              }
            }
            if (disableNullPointerExceptions) {
              return null;
            }
            throw new Error(
              "Null Pointer Exception: Property " +
                stringify(propertyName) +
                " not found in head (last position)" +
                " of context " +
                stringify(stack)
            );
          }
          // Use safe property access to prevent prototype pollution
          if (Object.prototype.hasOwnProperty.call(head, propertyName)) {
            const result = head[propertyName];
            whitelist.exitPropertyChain();
            return result;
          }
          whitelist.exitPropertyChain();
          return undefined;
        }

        const valueInContext: Maybe<unknown> =
          searchForPropertyValueInContextStack(propertyName);
        if (isNone(valueInContext)) {
          whitelist.exitPropertyChain();
          if (nullSafeNavigation) {
            return null;
          }
          if (fallbackToVariables) {
            const res = getValueInProvidedFuncsAndVars(propertyName);
            if (res.isSome) {
              return res.value;
            }
          }
          if (disableNullPointerExceptions) {
            return null;
          }
          throw new Error(
            "Null Pointer Exception: Property " +
              stringify(propertyName) +
              " not found in context " +
              stringify(stack)
          );
        }
        
        // Validate the accessed object for sensitive object detection
        try {
          whitelist.validateObjectAccess(valueInContext.value);
        } catch (error) {
          whitelist.exitPropertyChain();
          throw new Error(`Security violation: ${error.message}`);
        }
        
        whitelist.exitPropertyChain();
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
                  stringify(result) +
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
                    stringify(result) +
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
          "Cannot run selection expression on non-collection " + stringify(head)
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
          "Cannot run selection expression on non-array " + stringify(head)
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
          "Cannot run selection expression on non-array " + stringify(head)
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
              stringify(conditionResult)
          );
        }
      }
      case "VariableReference": {
        const valueInFuncsAndVars = getValueInProvidedFuncsAndVars(
          ast.variableName
        );
        if (isNone(valueInFuncsAndVars)) {
          if (disableNullPointerExceptions) {
            return null;
          }
          throw new Error(
            "Null Pointer Exception: variable " +
              stringify(ast.variableName) +
              " not found"
          );
        }
        return valueInFuncsAndVars.value;
      }
    }
  };
  return (ast: Ast) => {
    // Reset property chain depth for each new expression evaluation
    whitelist.resetPropertyChain();
    return evaluate(ast);
  };
};
