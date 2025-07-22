"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var uniq_1 = __importDefault(require("lodash/uniq"));
/**
 * In SPEL, quote characters are escaped by repeating them a second time.
 * See tests.
 */
var Q = {
    SINGLE_QUOTE: "'",
    DOUBLE_QUOTE: '"',
    TICK_QUOTE: "`",
    LEFT_SINGLE_QUOTE: "‘",
    RIGHT_SINGLE_QUOTE: "’",
    LEFT_DOUBLE_QUOTE: "“",
    RIGHT_DOUBLE_QUOTE: "”",
};
var isQuoteChar = function (ch, allowWeirdQuoteCharacters) {
    if (allowWeirdQuoteCharacters === void 0) { allowWeirdQuoteCharacters = false; }
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
var getCorrespondingQuoteChar = function (ch) {
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
var stringLiteral = function (input, allowWeirdQuoteCharacters) {
    if (allowWeirdQuoteCharacters === void 0) { allowWeirdQuoteCharacters = false; }
    var getMaybeQuoteChar = function (ix, // starting index
    matchingChars) {
        var scanIx = ix;
        var ch = input[scanIx];
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
    var firstNonWhitespaceCharacterIx = (function () {
        var _a;
        var i = 0;
        while (((_a = input[i]) === null || _a === void 0 ? void 0 : _a.trim()) === "") {
            i += 1;
        }
        return i;
    })();
    var firstNonWhitespaceChar = input[firstNonWhitespaceCharacterIx];
    var maybeQuoteChar = isQuoteChar(firstNonWhitespaceChar, allowWeirdQuoteCharacters)
        ? firstNonWhitespaceChar
        : null;
    if (maybeQuoteChar) {
        /** find the next matching quote char */
        for (var i = firstNonWhitespaceCharacterIx + 1; i < input.length;) {
            var maybeClosingQuoteChar = getMaybeQuoteChar(i, (0, uniq_1.default)([maybeQuoteChar, getCorrespondingQuoteChar(maybeQuoteChar)]));
            if (!maybeClosingQuoteChar) {
                // continue
                i += 1;
            }
            else if (maybeClosingQuoteChar.length % 2 !== 0) {
                // odd number of closing quote characters means the last one is unescaped.
                // found the closer.
                var remainingIx = i + maybeClosingQuoteChar.length;
                var stringContents = input.slice(firstNonWhitespaceCharacterIx + 1, remainingIx - 1);
                return [
                    // now lets replace escaped quote characters
                    stringContents.split(maybeQuoteChar.repeat(2)).join(maybeQuoteChar),
                    remainingIx,
                ];
            }
            else {
                // we already know continueIx has no quote char there, so we can skip over that char.
                i = maybeClosingQuoteChar.continueIx + 1;
            }
        }
        return -1;
    }
    return null;
};
exports.default = stringLiteral;
//# sourceMappingURL=stringLiteralSPELStyle.js.map