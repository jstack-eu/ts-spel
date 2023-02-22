import { ParsingError } from "./CustomErrors";
import { parse } from "./ParseToAst";

const assertError = (input: string, expectedError: ParsingError) => {
  expect(() => parse(input)).toThrow(expectedError);
  try {
    parse(input);
  } catch (e) {
    expect(e.index).toEqual(expectedError.index);
  }
};

it("empty input", () => {
  const input = "";
  const expectedError = new ParsingError(input, 0, "Generic");
  assertError(input, expectedError);
});

it("only whitespace", () => {
  const input = "   ";
  const expectedError = new ParsingError(input, 3, "Generic");
  assertError(input, expectedError);
});

it("1 1", () => {
  const input = "1 1";
  const expectedError = new ParsingError(input, 2, "Expression Remaining");
  assertError(input, expectedError);
});

it("1 /", () => {
  const input = "1 /";
  const expectedError = new ParsingError(input, 3, "No right operand for /");
  assertError(input, expectedError);
});

it("1 *", () => {
  const input = "1 *";
  const expectedError = new ParsingError(input, 3, "No right operand for *");
  assertError(input, expectedError);
});

it("* 1", () => {
  const input = "* 1";
  const expectedError = new ParsingError(input, 0, "No left operand for *");
  assertError(input, expectedError);
});

it("1 %% 2", () => {
  const input = "1 %% 2";
  const expectedError = new ParsingError(input, 3, "No right operand for %");
  assertError(input, expectedError);
});

it("1 &", () => {
  const input = "1 &";
  const expectedError = new ParsingError(input, 3, "Missing Character &");
  assertError(input, expectedError);
});

it("1 -", () => {
  const input = "1 -";
  const expectedError = new ParsingError(input, 3, "No right operand for -");
  assertError(input, expectedError);
});

it("1 &&", () => {
  const input = "1 &&";
  const expectedError = new ParsingError(input, 4, "No right operand for &&");
  assertError(input, expectedError);
});

it("1 |", () => {
  const input = "1 |";
  const expectedError = new ParsingError(input, 3, "Missing Character |");
  assertError(input, expectedError);
});

it("1 ||", () => {
  const input = "1 ||";
  const expectedError = new ParsingError(input, 4, "No right operand for ||");
  assertError(input, expectedError);
});

it("\\", () => {
  const input = "\\";
  const expectedError = new ParsingError(input, 0, "Expression Remaining");
  assertError(input, expectedError);
});

it("'f", () => {
  const input = "'f";
  const expectedError = new ParsingError(
    input,
    0,
    "Non-terminating quoted string"
  );
  assertError(input, expectedError);
});

it('"f', () => {
  const input = '"f';
  const expectedError = new ParsingError(
    input,
    0,
    "Non-terminating quoted string"
  );
  assertError(input, expectedError);
});

it("{", () => {
  const input = "{";
  const expectedError = new ParsingError(input, 1, "Expected }");
  assertError(input, expectedError);
});

it("{1", () => {
  const input = "{1";
  const expectedError = new ParsingError(input, 1, "Expected }");
  assertError(input, expectedError);
});

// fixme
it("(", () => {
  const input = "(";
  const expectedError = new ParsingError(input, 1, "Expected )");
  assertError(input, expectedError);
});

it("()", () => {
  const input = "()";
  const expectedError = new ParsingError(input, 1, "Expected expression in ()");
  assertError(input, expectedError);
});

it("(a  (b))", () => {
  const input = "(a  (b))";
  const expectedError = new ParsingError(input, 4, "Expected )");
  assertError(input, expectedError);
});

it("{1,", () => {
  const input = "{1,";
  const expectedError = new ParsingError(input, 1, "Expected }");
  assertError(input, expectedError);
});

it("{1,2", () => {
  const input = "{1,2";
  const expectedError = new ParsingError(input, 1, "Expected }");
  assertError(input, expectedError);
});

it("foo.![", () => {
  const input = "foo.![";
  const expectedError = new ParsingError(
    input,
    6,
    "Expected ] for Projection expression !["
  );
  assertError(input, expectedError);
});

it("foo.?[", () => {
  const input = "foo.?[";
  const expectedError = new ParsingError(
    input,
    6,
    "Expected ] for selection expression ?["
  );
  assertError(input, expectedError);
});

it("foo.^[", () => {
  const input = "foo.^[";
  const expectedError = new ParsingError(
    input,
    6,
    "Expected ] for selection expression ^["
  );
  assertError(input, expectedError);
});

it("foo.$[", () => {
  const input = "foo.$[";
  const expectedError = new ParsingError(
    input,
    6,
    "Expected ] for selection expression $["
  );
  assertError(input, expectedError);
});

it("foo[", () => {
  const input = "foo[";
  const expectedError = new ParsingError(input, 4, "Expected ]");
  assertError(input, expectedError);
});

it("foo[bar", () => {
  const input = "foo[bar";
  const expectedError = new ParsingError(input, 7, "Expected ]");
  assertError(input, expectedError);
});

it("foo?[", () => {
  const input = "foo?[";
  const expectedError = new ParsingError(input, 5, "Expected ]");
  assertError(input, expectedError);
});

it("func(", () => {
  const input = "func(";
  const expectedError = new ParsingError(
    input,
    5,
    "Expected ) for method call"
  );
  assertError(input, expectedError);
});

it("#func(", () => {
  const input = "#func(";
  const expectedError = new ParsingError(
    input,
    6,
    "Expected ) for function call"
  );
  assertError(input, expectedError);
});

it("a matches", () => {
  const input = "a matches";
  const expectedError = new ParsingError(
    input,
    9,
    "No right operand for 'matches'"
  );
  assertError(input, expectedError);
});

it("matches a", () => {
  const input = "matches a";
  const expectedError = new ParsingError(
    input,
    9,
    "Not an Operator",
    '"a" is not an operator'
  );
  assertError(input, expectedError);
});

it("a ?", () => {
  const input = "a ?";
  const expectedError = new ParsingError(input, 3, "Incomplete Ternary");
  assertError(input, expectedError);
});

it("a ? b", () => {
  const input = "a ? b";
  const expectedError = new ParsingError(input, 5, "Incomplete Ternary");
  assertError(input, expectedError);
});

it("a ? b :", () => {
  const input = "a ? b :";
  const expectedError = new ParsingError(input, 7, "Incomplete Ternary");
  assertError(input, expectedError);
});

it("foo.", () => {
  const input = "foo.";
  const expectedError = new ParsingError(input, 4, "Expected property after .");
  assertError(input, expectedError);
});

it("foo[]", () => {
  const input = "foo[]";
  const expectedError = new ParsingError(input, 4, "Expression expected in []");
  assertError(input, expectedError);
});

it("foo[  ]", () => {
  const input = "foo[  ]";
  const expectedError = new ParsingError(input, 6, "Expression expected in []");
  assertError(input, expectedError);
});

it("foo[", () => {
  const input = "foo[";
  const expectedError = new ParsingError(input, 4, "Expected ]");
  assertError(input, expectedError);
});

it("foo[1", () => {
  const input = "foo[1";
  const expectedError = new ParsingError(input, 5, "Expected ]");
  assertError(input, expectedError);
});
