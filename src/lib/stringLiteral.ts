const Q = {
  SINGLE_QUOTE: "'",
  DOUBLE_QUOTE: '"',
  TICK_QUOTE: '`',
};
const isQuote = (index: number, input: string) => {
  // if it's not a quote, return null
  // otherwise return escaped quote character we found.
  let escapeChars = '';
  if (
    input[index] === Q.SINGLE_QUOTE ||
    input[index] === Q.DOUBLE_QUOTE ||
    input[index] === Q.TICK_QUOTE
  ) {
    for (
      let backix = index - 1;
      backix >= 0 && input[backix] === '\\';
      backix--
    ) {
      escapeChars += '\\';
    }
    return escapeChars + input[index];
  } else {
    return null;
  }
};
// returnValue[1] is the index remaining after a successful string match
const stringLiteral = (input: string): [string, number] | null => {
  // find next quote (" or '), possible make these parameterizable, including ''' possibly.
  // then run until unescaped match.

  // stack of quote strings including escape chars prepended.
  const quoteStack: {
    index: number;
    quoteChar: string;
  }[] = [];
  let returnString = '';
  const peekQuoteStack = () =>
    quoteStack.length > 0 ? quoteStack[quoteStack.length - 1] : null;
  const getUnescapeChar = () =>
    quoteStack[0].quoteChar[quoteStack[0].quoteChar.length - 1];
  for (let i = 0; i < input.length; i++) {
    const maybeQuote = isQuote(i, input);
    if (maybeQuote) {
      const addQuoteToReturnString = () => {
        const unescapeChar = getUnescapeChar();
        if (maybeQuote.length > 1) {
          if (unescapeChar === maybeQuote[maybeQuote.length - 1]) {
            returnString = returnString.slice(0, -1); // remove an escapeChar
          }
          returnString += maybeQuote[maybeQuote.length - 1];
        } else if (maybeQuote !== unescapeChar) {
          returnString += maybeQuote;
        }
      };
      // handle quotation stack
      // and return if complete string has been found.
      const top = peekQuoteStack();
      if (top && maybeQuote === top.quoteChar) {
        addQuoteToReturnString();

        quoteStack.pop();

        if (quoteStack.length === 0) {
          // return unquoted string
          return [returnString, i + 1];
        }
      } else {
        quoteStack.push({
          quoteChar: maybeQuote,
          index: i,
        });
        addQuoteToReturnString();
      }
    } else {
      const isCurrentlyWhitespace = input[i].trim() === '';
      if (quoteStack.length === 0 && !isCurrentlyWhitespace) {
        // reached something before string
        return null;
      } else if (quoteStack.length > 0) {
        returnString += input[i];
      }
    }
  }
  return null;
};

export default stringLiteral;
