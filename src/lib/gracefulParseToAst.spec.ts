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

it("should gracefully parse an unclosed string literal in an unclosed function call", () => {
  expect(parse('foo("a', true)).toEqual<Ast>({
    type: "MethodReference",
    methodName: "foo",
    __unclosed: true,
    nullSafeNavigation: false,
    args: [
      {
        type: "StringLiteral",
        value: "a",
        __unclosed: true,
      },
    ],
  });
});

it("should gracefully parse unclosed method call, including empty trailing arguments after last comma", () => {
  expect(parse('foo("a",', true)).toEqual<Ast>({
    type: "MethodReference",
    methodName: "foo",
    __unclosed: true,
    nullSafeNavigation: false,
    args: [
      {
        type: "StringLiteral",
        value: "a",
      },
      null,
    ],
  });
});

it("should gracefully unclosed Inline Maps", () => {
  expect(
    parse(
      `#f().date.of().is.after({
        date: "foo",
        time: f.`,
      true
    )
  ).toEqual<Ast>({
    type: "CompoundExpression",
    expressionComponents: [
      {
        type: "FunctionReference",
        nullSafeNavigation: false,
        functionName: "f",
        args: [],
      },
      {
        type: "PropertyReference",
        propertyName: "date",
        nullSafeNavigation: false,
      },
      {
        type: "MethodReference",
        nullSafeNavigation: false,
        methodName: "of",
        args: [],
      },
      {
        type: "PropertyReference",
        propertyName: "is",
        nullSafeNavigation: false,
      },
      {
        type: "MethodReference",
        nullSafeNavigation: false,
        methodName: "after",
        args: [
          {
            type: "InlineMap",
            elements: {
              date: {
                type: "StringLiteral",
                value: "foo",
              },
              time: {
                type: "CompoundExpression",
                expressionComponents: [
                  {
                    nullSafeNavigation: false,
                    propertyName: "f",
                    type: "PropertyReference",
                  },
                  {
                    nullSafeNavigation: false,
                    propertyName: "",
                    type: "PropertyReference",
                  },
                ],
              },
            },
            __unclosed: true,
          },
        ],
        __unclosed: true,
      },
    ],
  });
});
