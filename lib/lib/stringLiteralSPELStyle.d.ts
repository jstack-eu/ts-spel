declare const stringLiteral: (input: string, allowWeirdQuoteCharacters?: boolean) => [
    string,
    number
] | -1 | null;
export default stringLiteral;
