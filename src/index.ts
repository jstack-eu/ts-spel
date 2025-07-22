import { getEvaluator, EvalOptions } from './lib/Evaluate';
import { parse } from './lib/ParseToAst';

export { 
  parse, 
  getEvaluator
};

// Convenience function for null-safe evaluation
export const getSafeEvaluator = (
  rootContext: Record<string, unknown>,
  functionsAndVariables: 
    | Record<string, unknown>
    | Array<Record<string, unknown>>,
  options?: EvalOptions
) => {
  return getEvaluator(rootContext, functionsAndVariables, {
    disableNullPointerExceptions: true,
    ...options
  });
};
