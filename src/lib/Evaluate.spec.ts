import test from 'ava';

import { getEvaluator } from './Evaluate';
import { parse } from './ParseToAst';

test('Can evaluate properties', (t) => {
  const r = parse('foo');
  t.is(getEvaluator({ foo: false }, {})(r), false);
});

test('should evaluate multiplication with higher precedence', (t) => {
  t.deepEqual(getEvaluator({}, {})(parse('1+2*3')), 7);
});
test('should evaluate sequence of operations', (t) => {
  t.deepEqual(getEvaluator({}, {})(parse('2*3*5')), 30);
});
test('should evaluate parenthesis', (t) => {
  t.deepEqual(getEvaluator({}, {})(parse('(5+8)/13')), 1);
});
test('should evaluate fully parenthesized', (t) => {
  t.deepEqual(getEvaluator({}, {})(parse('(5-(2*3))')), -1);
});
test('should evaluate exponentiation', (t) => {
  t.deepEqual(getEvaluator({}, {})(parse('2*2**8')), 512);
});
test('should evaluate negation', (t) => {
  t.deepEqual(getEvaluator({}, {})(parse('2**-(2*-2)+-5')), 11);
});

test('Can index into arrays', (t) => {
  const r = parse('{1, 2, {3, 4}}[2][0]');
  t.is(getEvaluator({}, {})(r), 3);
});
test('Safe-navigate index (not null)', (t) => {
  const r = parse('{1, 2, 3}?[2]');
  t.is(getEvaluator({}, {})(r), 3);
});
test('Safe-navigate index (null)', (t) => {
  const r = parse('null?[2]');
  t.is(getEvaluator({}, {})(r), null);
});
test('can evaluate negative number literals', (t) => {
  const r = parse('-1');
  t.is(getEvaluator({}, {})(r), -1);
});
test('can evaluate an inline list', (t) => {
  const r = parse('{1, 2, 3}');
  t.deepEqual(getEvaluator({}, {})(r), [1, 2, 3]);
});
test('can evaluate elvis', (t) => {
  const r1 = parse('1 ?: 2');
  t.is(getEvaluator({}, {})(r1), 1);
  const r2 = parse('null ?: 2');
  t.is(getEvaluator({}, {})(r2), 2);
});
test('can evaluate SelectionAll: get evens', (t) => {
  const r1 = parse('{1, 2, 3, 4, 5}.?[#this % 2 == 0]');
  t.deepEqual(getEvaluator({}, {})(r1), [2, 4]);
});
test('Safe nav SelectionAll (not null)', (t) => {
  const r1 = parse('{1, 2, 3, 4, 5}?.?[#this % 2 == 0]');
  t.deepEqual(getEvaluator({}, {})(r1), [2, 4]);
});
test('Safe nav SelectionAll (null)', (t) => {
  const r1 = parse('null?.?[#this % 2 == 0]');
  t.deepEqual(getEvaluator({}, {})(r1), null);
});
test('Can evaluate SelectionLast: get even', (t) => {
  const r1 = parse('{1, 2, 3, 4, 5}.$[#this % 2 == 0]');
  t.deepEqual(getEvaluator({}, {})(r1), 4);
});
test('Safe-navigate SelectionLast (not null)', (t) => {
  const r1 = parse('{1, 2, 3, 4, 5}?.$[#this % 2 == 0]');
  t.deepEqual(getEvaluator({}, {})(r1), 4);
});
test('Safe-navigation SelectionFirst', (t) => {
  const r1 = parse('null?.^[#this % 2 == 0]');
  t.deepEqual(getEvaluator({}, {})(r1), null);
});
test('Can evaluate Projection: * 2', (t) => {
  const r1 = parse('{1, 2, 3, 4, 5}.![#this * 2]');
  t.deepEqual(getEvaluator({}, {})(r1), [2, 4, 6, 8, 10]);
});
test('Safe-navigate Projection', (t) => {
  const r1 = parse('{1, 2, 3, 4, 5}?.![#this * 2]');
  t.deepEqual(getEvaluator({}, {})(r1), [2, 4, 6, 8, 10]);
});
test('Safe-navigate Projection (null)', (t) => {
  const r1 = parse('getNull()?.![#this * 2]');
  t.deepEqual(getEvaluator({ getNull: () => null }, {})(r1), null);
});
test('can evaluate a method with variable arguments', (t) => {
  t.deepEqual(
    getEvaluator(
      { fn: (...args) => args.reduce((prev, curr) => prev + curr, 0) },
      {}
    )(parse('fn(1, 2, 3)')),
    6
  );
});

test('foo.bar.baz != null ? foo.bar.baz : null', (t) => {
  t.deepEqual(
    getEvaluator(
      {
        foo: {
          bar: {
            baz: null,
          },
        },
      },
      {}
    )(parse('foo.bar.baz != null ? foo.bar.baz : null')),
    null
  );
});

test('>=', (t) => {
  t.is(getEvaluator({}, {})(parse('5 >= 5')), true);
  t.is(getEvaluator({}, {})(parse('4 >= 5')), false);
});
test('Can evaluate functions and variables', (t) => {
  const evaluate = getEvaluator(
    {
      foo: () => 'fromLocals',
      var: 'fromLocals',
    },
    {
      foo: () => 'fromGlobals',
      var: 'fromGlobals',
    }
  );
  t.is(evaluate(parse('#foo()')), 'fromGlobals');
  t.is(evaluate(parse('foo()')), 'fromLocals');
  t.is(evaluate(parse('#var')), 'fromGlobals');
  t.is(evaluate(parse('var')), 'fromLocals');
});
test('Null behavior with boolean operators', (t) => {
  t.is(getEvaluator({}, {})(parse('!null')), true);
  t.is(getEvaluator({}, {})(parse('null || true')), true);
  t.is(getEvaluator({}, {})(parse('null && true')), null);
  t.is(getEvaluator({}, {})(parse('true && null')), null);
  t.is(getEvaluator({}, {})(parse('!!(true && null)')), false);
});
test('Boolean operators short circuit: &&', (t) => {
  t.is(
    getEvaluator(
      {
        foo: false,
      },
      {}
    )(parse('foo && foo()')),
    false
  );
});

test('Boolean operators short circuit: ||', (t) => {
  t.is(
    getEvaluator(
      {
        foo: true,
      },
      {}
    )(parse('foo || foo()')),
    true
  );
});
test('Ternary function call', (t) => {
  t.is(
    getEvaluator(
      {
        currentUserHasRole: () => false,
      },
      {}
    )(parse("currentUserHasRole('ROLE_SUPER') ? npe() : 'hello'")),
    'hello'
  );
  t.is(
    getEvaluator(
      {
        currentUserHasRole: () => true,
      },
      {}
    )(parse("currentUserHasRole('ROLE_SUPER') ? 'hello' : npe()")),
    'hello'
  );
});
