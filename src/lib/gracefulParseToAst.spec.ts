import { Ast } from "./Ast";
import { parse } from "./ParseToAst";

/**
 * TODO below should actually throw because it's not graceful lol
 */
it("should gracefully parse with missing right operand", () => {
  expect(parse("1 -", true)).toEqual({
    type: "OpMinus",
    left: {
      type: "NumberLiteral",
      value: 1,
    },
    right: null,
  });
});

it("should gracefully parse incomplete paren and compound ending in .", () => {
  expect(parse("(foo?.bar.", true)).toEqual<Ast>({
    type: "CompoundExpression",
    expressionComponents: [
      {
        type: "PropertyReference",
        nullSafeNavigation: false,
        propertyName: "foo",
      },
      {
        type: "PropertyReference",
        nullSafeNavigation: true,
        propertyName: "bar",
      },
      {
        type: "PropertyReference",
        nullSafeNavigation: false,
        propertyName: "",
      },
    ],
  });
});

it("should gracefully parse incomplete selection expression", () => {
  expect(parse("foo.?[#this.", true)).toEqual<Ast>({
    type: "CompoundExpression",
    expressionComponents: [
      {
        type: "PropertyReference",
        nullSafeNavigation: false,
        propertyName: "foo",
      },
      {
        type: "SelectionAll",
        nullSafeNavigation: false,
        __unclosed: true,
        expression: {
          type: "CompoundExpression",
          expressionComponents: [
            {
              type: "VariableReference",
              variableName: "this",
            },
            {
              type: "PropertyReference",
              nullSafeNavigation: false,
              propertyName: "",
            },
          ],
        },
      },
    ],
  });
});

it("should gracefully parse unclosed string literals", () => {
  expect(parse("a == 'abc ", true)).toEqual<Ast>({
    type: "OpEQ",
    left: {
      type: "PropertyReference",
      nullSafeNavigation: false,
      propertyName: "a",
    },
    right: {
      type: "StringLiteral",
      value: "abc",
      __unclosed: true,
    },
  });
});
