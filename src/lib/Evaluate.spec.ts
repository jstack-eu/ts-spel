import { getEvaluator } from "./Evaluate";
import { parse } from "./ParseToAst";

describe("Evaluation", () => {
  it("Can evaluate properties", () => {
    const r = parse("foo");
    expect(getEvaluator({ foo: false }, {})(r)).toBe(false);
  });

  it("should evaluate multiplication with higher precedence", () => {
    expect(getEvaluator({}, {})(parse("1+2*3"))).toBe(7);
  });
  it("should evaluate sequence of operations", () => {
    expect(getEvaluator({}, {})(parse("2*3*5"))).toBe(30);
  });
  it("should evaluate parenthesis", () => {
    expect(getEvaluator({}, {})(parse("(5+8)/13"))).toBe(1);
  });
  it("should evaluate fully parenthesized", () => {
    expect(getEvaluator({}, {})(parse("(5-(2*3))"))).toBe(-1);
  });
  it("should evaluate exponentiation", () => {
    expect(getEvaluator({}, {})(parse("2*2^8"))).toBe(512);
  });
  it("should evaluate negation", () => {
    expect(getEvaluator({}, {})(parse("2^-(2*-2)+-5"))).toBe(11);
  });

  it("Can index into arrays", () => {
    const r = parse("{1, 2, {3, 4}}[2][0]");
    expect(getEvaluator({}, {})(r)).toBe(3);
  });
  it("Safe-navigate index (not null)", () => {
    const r = parse("{1, 2, 3}?[2]");
    expect(getEvaluator({}, {})(r)).toBe(3);
  });
  it("Safe-navigate index (null)", () => {
    const r = parse("null?[2]");
    expect(getEvaluator({}, {})(r)).toBe(null);
  });
  it("can evaluate negative number literals", () => {
    const r = parse("-1");
    expect(getEvaluator({}, {})(r)).toBe(-1);
  });
  it("can evaluate an inline list", () => {
    const r = parse("{1, 2, 3}");
    expect(getEvaluator({}, {})(r)).toEqual([1, 2, 3]);
  });
  it("can evaluate elvis", () => {
    const r1 = parse("1 ?: 2");
    expect(getEvaluator({}, {})(r1)).toBe(1);
    const r2 = parse("null ?: 2");
    expect(getEvaluator({}, {})(r2)).toBe(2);
  });
  it("can evaluate SelectionAll: get evens", () => {
    const r1 = parse("{1, 2, 3, 4, 5}.?[#this % 2 == 0]");
    expect(getEvaluator({}, {})(r1)).toEqual([2, 4]);
  });
  it("Safe nav SelectionAll (not null)", () => {
    const r1 = parse("{1, 2, 3, 4, 5}?.?[#this % 2 == 0]");
    expect(getEvaluator({}, {})(r1)).toEqual([2, 4]);
  });
  it("Safe nav SelectionAll (null)", () => {
    const r1 = parse("null?.?[#this % 2 == 0]");
    expect(getEvaluator({}, {})(r1)).toBe(null);
  });
  it("Can evaluate SelectionLast: get even", () => {
    const r1 = parse("{1, 2, 3, 4, 5}.$[#this % 2 == 0]");
    expect(getEvaluator({}, {})(r1)).toBe(4);
  });
  it("Safe-navigate SelectionLast (not null)", () => {
    const r1 = parse("{1, 2, 3, 4, 5}?.$[#this % 2 == 0]");
    expect(getEvaluator({}, {})(r1)).toBe(4);
  });
  it("Safe-navigation SelectionFirst", () => {
    const r1 = parse("null?.^[#this % 2 == 0]");
    expect(getEvaluator({}, {})(r1)).toBe(null);
  });
  it("Can evaluate Projection: * 2", () => {
    const r1 = parse("{1, 2, 3, 4, 5}.![#this * 2]");
    expect(getEvaluator({}, {})(r1)).toEqual([2, 4, 6, 8, 10]);
  });
  it("Safe-navigate Projection", () => {
    const r1 = parse("{1, 2, 3, 4, 5}?.![#this * 2]");
    expect(getEvaluator({}, {})(r1)).toEqual([2, 4, 6, 8, 10]);
  });
  it("Safe-navigate Projection (null)", () => {
    const r1 = parse("getNull()?.![#this * 2]");
    expect(getEvaluator({ getNull: () => null }, {})(r1)).toBe(null);
  });
  it("can evaluate a method with variable arguments", () => {
    expect(
      getEvaluator(
        { fn: (...args) => args.reduce((prev, curr) => prev + curr, 0) },
        {}
      )(parse("fn(1, 2, 3)"))
    ).toBe(6);
  });

  it("foo.bar.baz != null ? foo.bar.baz : null", () => {
    expect(
      getEvaluator(
        {
          foo: {
            bar: {
              baz: null,
            },
          },
        },
        {}
      )(parse("foo.bar.baz != null ? foo.bar.baz : null"))
    ).toBe(null);
  });

  it(">=", () => {
    expect(getEvaluator({}, {})(parse("5 >= 5"))).toBe(true);
    expect(getEvaluator({}, {})(parse("4 >= 5"))).toBe(false);
  });
  it("Can evaluate functions and variables", () => {
    const evaluate = getEvaluator(
      {
        foo: () => "fromLocals",
        var: "fromLocals",
      },
      {
        foo: () => "fromGlobals",
        var: "fromGlobals",
      }
    );
    expect(evaluate(parse("#foo()"))).toBe("fromGlobals");
    expect(evaluate(parse("foo()"))).toBe("fromLocals");
    expect(evaluate(parse("#var"))).toBe("fromGlobals");
    expect(evaluate(parse("var"))).toBe("fromLocals");
  });
  it("Null behavior with boolean operators", () => {
    expect(getEvaluator({}, {})(parse("!null"))).toBe(true);
    expect(getEvaluator({}, {})(parse("null || true"))).toBe(true);
    expect(getEvaluator({}, {})(parse("null && true"))).toBe(null);
    expect(getEvaluator({}, {})(parse("true && null"))).toBe(null);
    expect(getEvaluator({}, {})(parse("!!(true && null)"))).toBe(false);
  });
  it("Boolean operators short circuit: &&", () => {
    expect(
      getEvaluator(
        {
          foo: false,
        },
        {}
      )(parse("foo && foo()"))
    ).toBe(false);
  });

  it("Boolean operators short circuit: ||", () => {
    expect(
      getEvaluator(
        {
          foo: true,
        },
        {}
      )(parse("foo || foo()"))
    ).toBe(true);
  });
  it("Ternary function call", () => {
    expect(
      getEvaluator(
        {
          currentUserHasRole: () => false,
        },
        {}
      )(parse("currentUserHasRole('ROLE_SUPER') ? npe() : 'hello'"))
    ).toBe("hello");
    expect(
      getEvaluator(
        {
          currentUserHasRole: () => true,
        },
        {}
      )(parse("currentUserHasRole('ROLE_SUPER') ? 'hello' : npe()"))
    ).toBe("hello");
  });
});
