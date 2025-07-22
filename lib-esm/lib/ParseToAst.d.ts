import { Ast } from "./Ast";
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
export declare const parse: (input: string, graceful?: boolean, allowWeirdQuoteCharacters?: boolean) => Ast;
