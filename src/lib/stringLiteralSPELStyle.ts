import uniq from "lodash/uniq";
/**
 * In SPEL, quote characters are escaped by repeating them a second time.
 * See tests.
 */
const Q = {
  SINGLE_QUOTE: "'",
  DOUBLE_QUOTE: '"',
  TICK_QUOTE: "`",
  LEFT_SINGLE_QUOTE: "‘",
  RIGHT_SINGLE_QUOTE: "’",
  LEFT_DOUBLE_QUOTE: "“",
  RIGHT_DOUBLE_QUOTE: "”",
};
const isQuoteChar = (ch: string, allowWeirdQuoteCharacters = false) => {
  switch (ch) {
    case Q.SINGLE_QUOTE:
    case Q.DOUBLE_QUOTE:
    case Q.TICK_QUOTE:
      return true;
    case Q.LEFT_SINGLE_QUOTE:
    case Q.RIGHT_SINGLE_QUOTE:
    case Q.LEFT_DOUBLE_QUOTE:
    case Q.RIGHT_DOUBLE_QUOTE:
      return allowWeirdQuoteCharacters;
  }
  return false;
};

const getCorrespondingQuoteChar = (ch: string) => {
  switch (ch) {
    case Q.LEFT_SINGLE_QUOTE:
      return Q.RIGHT_SINGLE_QUOTE;
    case Q.LEFT_DOUBLE_QUOTE:
      return Q.RIGHT_DOUBLE_QUOTE;
    default:
      return ch;
  }
};
// returnValue[1] is the index remaining after a successful string match
// -1 means unclosed string error
const stringLiteral = (
  input: string,
  allowWeirdQuoteCharacters = false
): [string, number] | -1 | null => {
  const getMaybeQuoteChar = (
    ix: number, // starting index
    matchingChars: (typeof Q)[keyof typeof Q][]
  ): null | {
    char: string;
    length: number; // number of times it is repeated
    continueIx: number;
  } => {
    let scanIx = ix;
    const ch = input[scanIx];
    if (matchingChars.includes(ch)) {
      while (input[++scanIx] === ch) {
        // continue
      }
      // scanIx is now the index of the first non-continuation of the quote sequence
      return {
        char: ch,
        length: scanIx - ix,
        continueIx: scanIx,
      };
    }
    return null;
  };
  const firstNonWhitespaceCharacterIx = (() => {
    let i = 0;
    while (input[i]?.trim() === "") {
      i += 1;
    }
    return i;
  })();
  const firstNonWhitespaceChar = input[firstNonWhitespaceCharacterIx];
  const maybeQuoteChar = isQuoteChar(
    firstNonWhitespaceChar,
    allowWeirdQuoteCharacters
  )
    ? firstNonWhitespaceChar
    : null;
  if (maybeQuoteChar) {
    /** find the next matching quote char */
    for (let i = firstNonWhitespaceCharacterIx + 1; i < input.length; ) {
      const maybeClosingQuoteChar = getMaybeQuoteChar(
        i,
        uniq([maybeQuoteChar, getCorrespondingQuoteChar(maybeQuoteChar)])
      );
      if (!maybeClosingQuoteChar) {
        // continue
        i += 1;
      } else if (maybeClosingQuoteChar.length % 2 !== 0) {
        // odd number of closing quote characters means the last one is unescaped.
        // found the closer.
        const remainingIx = i + maybeClosingQuoteChar.length;
        const stringContents = input.slice(
          firstNonWhitespaceCharacterIx + 1,
          remainingIx - 1
        );
        return [
          // now lets replace escaped quote characters
          stringContents.split(maybeQuoteChar.repeat(2)).join(maybeQuoteChar), // <- doesn't handle all combinations of pairs of curly left/right quotes. For now that's ok. Handling those is non-standard anyway.
          remainingIx,
        ];
      } else {
        // we already know continueIx has no quote char there, so we can skip over that char.
        i = maybeClosingQuoteChar.continueIx + 1;
      }
    }
    return -1;
  }
  return null;
};

export default stringLiteral;
