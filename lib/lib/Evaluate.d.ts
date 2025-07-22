import { Ast } from "./Ast";
export type EvalOptions = {
    disableBoolOpChecks?: true;
    disableNullPointerExceptions?: true;
    fallbackToFunctions?: true;
    fallbackToVariables?: true;
};
export declare const getEvaluator: (rootContext: Record<string, unknown>, functionsAndVariables: Record<string, unknown> | Array<Record<string, unknown>>, options?: EvalOptions) => (ast: Ast) => unknown;
