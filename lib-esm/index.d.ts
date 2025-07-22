import { getEvaluator, EvalOptions } from './lib/Evaluate';
import { parse } from './lib/ParseToAst';
export { parse, getEvaluator };
export declare const getSafeEvaluator: (rootContext: Record<string, unknown>, functionsAndVariables: Record<string, unknown> | Array<Record<string, unknown>>, options?: EvalOptions) => (ast: import("./lib/Ast").Ast) => unknown;
