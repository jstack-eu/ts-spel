/**
 * In SPEL, quote characters are escaped by repeating them a second time.
 * See tests.
 */
const Q = {
  SINGLE_QUOTE: "'",
  DOUBLE_QUOTE: '"',
  TICK_QUOTE: '`',
};
const isQuoteChar = (ch: string) => Object.values(Q).includes(ch);

// returnValue[1] is the index remaining after a successful string match
const stringLiteral = (input: string): [string, number] | null => {
  const getMaybeQuoteChar = (
    ix: number,
    matchingChar?: typeof Q[keyof typeof Q]
  ): null | {
    char: string;
    length: number; // number of times it is repeated
    continueIx: number;
  } => {
    let scanIx = ix;
    const ch = input[scanIx];
    if (matchingChar ? matchingChar === ch : isQuoteChar(ch)) {
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
    while (input[i]?.trim() === '') {
      i += 1;
    }
    return i;
  })();
  const firstNonWhitespaceChar = input[firstNonWhitespaceCharacterIx];
  const maybeQuoteChar = isQuoteChar(firstNonWhitespaceChar)
    ? firstNonWhitespaceChar
    : null;
  if (maybeQuoteChar) {
    /** find the next matching quote char */
    for (let i = firstNonWhitespaceCharacterIx + 1; i < input.length; ) {
      const maybeClosingQuoteChar = getMaybeQuoteChar(i, maybeQuoteChar);
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
          stringContents.split(maybeQuoteChar.repeat(2)).join(maybeQuoteChar),
          remainingIx,
        ];
      } else {
        // we already know continueIx has no quote char there, so we can skip over that char.
        i = maybeClosingQuoteChar.continueIx + 1;
      }
    }
  }
  return null;
};

export default stringLiteral;
