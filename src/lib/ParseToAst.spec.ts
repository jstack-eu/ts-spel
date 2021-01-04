import test from 'ava';

import { parse } from './ParseToAst';

test('Throws an exception if input is not a single complete expression.', (t) => {
  const error = t.throws(() => parse('144 12'));
  t.is(
    error.message,
    'Parsing incomplete at index 4 expression remaining: "12"'
  );
});

test('Throws an exception on empty input', (t) => {
  const error = t.throws(() => parse(''));
  t.is(error.message, 'expression "" could not be parsed. index: 0');
});

test('Throws an exception on whitespace only input', (t) => {
  const error = t.throws(() => parse('  '));
  t.is(error.message, 'expression "  " could not be parsed. index: 2');
});

test('Throws an exception on incomplete ternary', (t) => {
  const error1 = t.throws(() => parse(' asdf ? asdf '));
  t.is(error1.message, 'Incomplete ternary expression. index: 13');
  const error2 = t.throws(() => parse(' asdf ? asdf : '));
  t.is(error2.message, 'Incomplete ternary expression. index: 15');
});

test('should parse integer', (t) => {
  t.deepEqual(parse('144'), {
    type: 'NumberLiteral',
    value: 144,
  });
});
test('should parse float', (t) => {
  t.deepEqual(parse('1.618'), {
    type: 'NumberLiteral',
    value: 1.618,
  });
});
test('should parse negative integer', (t) => {
  t.deepEqual(parse('-13'), {
    type: 'Negative',
    value: {
      type: 'NumberLiteral',
      value: 13,
    },
  });
});
test('should parse resulting zero', (t) => {
  t.deepEqual(parse('14-13'), {
    type: 'OpMinus',
    left: {
      type: 'NumberLiteral',
      value: 14,
    },
    right: {
      type: 'NumberLiteral',
      value: 13,
    },
  });
});

test('should parse with whitespace', (t) => {
  console.log('ASDF', parse('14 - 13'));
  t.deepEqual(parse('14 - 13'), {
    type: 'OpMinus',
    left: {
      type: 'NumberLiteral',
      value: 14,
    },
    right: {
      type: 'NumberLiteral',
      value: 13,
    },
  });
});
test('should parse starting with zero', (t) => {
  t.deepEqual(parse('0-5'), {
    type: 'OpMinus',
    left: {
      type: 'NumberLiteral',
      value: 0,
    },
    right: {
      type: 'NumberLiteral',
      value: 5,
    },
  });
});
test('should parse containing zero', (t) => {
  t.deepEqual(parse('13+0*1'), {
    type: 'OpPlus',
    left: {
      type: 'NumberLiteral',
      value: 13,
    },
    right: {
      type: 'OpMultiply',
      left: {
        type: 'NumberLiteral',
        value: 0,
      },
      right: {
        type: 'NumberLiteral',
        value: 1,
      },
    },
  });
});
test('Property parsing', (t) => {
  t.deepEqual(parse('foo'), {
    type: 'PropertyReference',
    nullSafeNavigation: false,
    propertyName: 'foo',
  });
});
test('Simple string parsing', (t) => {
  t.deepEqual(parse(' "foo" '), {
    type: 'StringLiteral',
    value: 'foo',
  });
});
test('Simple string parsing single quotes', (t) => {
  t.deepEqual(parse(" 'foo' "), {
    type: 'StringLiteral',
    value: 'foo',
  });
});
test('String parsing: escape characters 1 deep', (t) => {
  t.deepEqual(parse(' "-?> \\"foo\\" dfs9 " '), {
    type: 'StringLiteral',
    value: '-?> "foo" dfs9 ',
  });
});
test('String parsing: escape characters 2 deep', (t) => {
  t.deepEqual(parse('  "hello, I was told \\" Say \\\\"hi\\\\" \\" " '), {
    type: 'StringLiteral',
    value: 'hello, I was told " Say \\"hi\\" " ',
  });
});
test('quoting', (t) => {
  t.deepEqual(
    parse('  "hello, I was told \\" Say \\\\"hi \'jack\' \\\\" \\" " '),
    {
      type: 'StringLiteral',
      value: 'hello, I was told " Say \\"hi \'jack\' \\" " ',
    }
  );
});
test('mixed but starting with sq', (t) => {
  t.deepEqual(parse("  'they said, \" tell them \\'I said hi\\' \" ' "), {
    type: 'StringLiteral',
    value: 'they said, " tell them \'I said hi\' " ',
  });
});
test('literal (null)', (t) => {
  t.deepEqual(parse('  null '), {
    type: 'NullLiteral',
  });
});

test('null', (t) => {
  t.deepEqual(parse('null ?: 1'), {
    type: 'Elvis',
    expression: {
      type: 'NullLiteral',
    },
    ifFalse: {
      type: 'NumberLiteral',
      value: 1,
    },
  });
});
test('Inline Lists', (t) => {
  t.deepEqual(parse('{1,2,3,4}'), {
    type: 'InlineList',
    elements: [
      {
        type: 'NumberLiteral',
        value: 1,
      },
      {
        type: 'NumberLiteral',
        value: 2,
      },
      {
        type: 'NumberLiteral',
        value: 3,
      },
      {
        type: 'NumberLiteral',
        value: 4,
      },
    ],
  });
});
test('Inline Map', (t) => {
  t.deepEqual(parse('{foo: 1 + 1, bar: 3 }'), {
    type: 'InlineMap',
    elements: {
      foo: {
        type: 'OpPlus',
        left: {
          type: 'NumberLiteral',
          value: 1,
        },
        right: {
          type: 'NumberLiteral',
          value: 1,
        },
      },
      bar: {
        type: 'NumberLiteral',
        value: 3,
      },
    },
  });
});
test('Parsing: this == "z"', (t) => {
  t.deepEqual(parse('#this == "z"'), {
    type: 'OpEQ',
    left: {
      type: 'VariableReference',
      variableName: 'this',
    },
    right: {
      type: 'StringLiteral',
      value: 'z',
    },
  });
});
test('Parsing: foo.?[#this == "z"]', (t) => {
  t.deepEqual(parse('foo.?[#this == "z"]'), {
    type: 'CompoundExpression',
    expressionComponents: [
      {
        type: 'PropertyReference',
        nullSafeNavigation: false,
        propertyName: 'foo',
      },
      {
        type: 'SelectionAll',
        nullSafeNavigation: false,
        expression: {
          type: 'OpEQ',
          left: {
            type: 'VariableReference',
            variableName: 'this',
          },
          right: {
            type: 'StringLiteral',
            value: 'z',
          },
        },
      },
    ],
  });
});

test('Parsing: {1}.$[#this % 2 == 0]', (t) => {
  t.deepEqual(parse('{1}.$[#this % 2 == 0]'), {
    type: 'CompoundExpression',
    expressionComponents: [
      {
        type: 'InlineList',
        elements: [
          {
            type: 'NumberLiteral',
            value: 1,
          },
        ],
      },
      {
        type: 'SelectionLast',
        nullSafeNavigation: false,
        expression: {
          type: 'OpEQ',
          left: {
            type: 'OpModulus',
            left: {
              type: 'VariableReference',
              variableName: 'this',
            },
            right: {
              type: 'NumberLiteral',
              value: 2,
            },
          },
          right: {
            type: 'NumberLiteral',
            value: 0,
          },
        },
      },
    ],
  });
});
test('Inline Lists with negative elements', (t) => {
  t.deepEqual(parse('{1, 2, -3}'), {
    type: 'InlineList',
    elements: [
      {
        type: 'NumberLiteral',
        value: 1,
      },
      {
        type: 'NumberLiteral',
        value: 2,
      },
      {
        type: 'Negative',
        value: {
          type: 'NumberLiteral',
          value: 3,
        },
      },
    ],
  });
});
test('elvis with trailing negative', (t) => {
  t.deepEqual(parse('null ?: -7'), {
    type: 'Elvis',
    expression: {
      type: 'NullLiteral',
    },
    ifFalse: {
      type: 'Negative',
      value: {
        type: 'NumberLiteral',
        value: 7,
      },
    },
  });
});
test('Parsing: {1, 2, -3}?.$[#this % 2 == 0] ?: -7', (t) => {
  t.deepEqual(parse('{1, 2, -3}?.$[#this % 2 == 0] ?: -7'), {
    type: 'Elvis',
    expression: {
      type: 'CompoundExpression',
      expressionComponents: [
        {
          type: 'InlineList',
          elements: [
            {
              type: 'NumberLiteral',
              value: 1,
            },
            {
              type: 'NumberLiteral',
              value: 2,
            },
            {
              type: 'Negative',
              value: {
                type: 'NumberLiteral',
                value: 3,
              },
            },
          ],
        },
        {
          type: 'SelectionLast',
          nullSafeNavigation: true,
          expression: {
            type: 'OpEQ',
            left: {
              type: 'OpModulus',
              left: {
                type: 'VariableReference',
                variableName: 'this',
              },
              right: {
                type: 'NumberLiteral',
                value: 2,
              },
            },
            right: {
              type: 'NumberLiteral',
              value: 0,
            },
          },
        },
      ],
    },
    ifFalse: {
      type: 'Negative',
      value: {
        type: 'NumberLiteral',
        value: 7,
      },
    },
  });
});
test('Parsing: {1}.![#this * 2]', (t) => {
  t.deepEqual(parse('{1}.![#this * 2]'), {
    type: 'CompoundExpression',
    expressionComponents: [
      {
        type: 'InlineList',
        elements: [
          {
            type: 'NumberLiteral',
            value: 1,
          },
        ],
      },
      {
        type: 'Projection',
        nullSafeNavigation: false,
        expression: {
          type: 'OpMultiply',
          left: {
            type: 'VariableReference',
            variableName: 'this',
          },
          right: {
            type: 'NumberLiteral',
            value: 2,
          },
        },
      },
    ],
  });
});

test('Parsing: simple ternary', (t) => {
  t.deepEqual(parse('true ? "true" : "false"'), {
    type: 'Ternary',
    expression: {
      type: 'BooleanLiteral',
      value: true,
    },
    ifTrue: {
      type: 'StringLiteral',
      value: 'true',
    },
    ifFalse: {
      type: 'StringLiteral',
      value: 'false',
    },
  });
});

test('Parsing: foo() && arr?[0] > 0 || "fooc"', (t) => {
  t.deepEqual(parse('foo() && arr?[0] > 0 || "fooc"'), {
    type: 'OpOr',
    left: {
      type: 'OpAnd',
      left: {
        type: 'MethodReference',
        nullSafeNavigation: false,
        methodName: 'foo',
        args: [],
      },
      right: {
        type: 'OpGT',
        left: {
          type: 'CompoundExpression',
          expressionComponents: [
            {
              type: 'PropertyReference',
              nullSafeNavigation: false,
              propertyName: 'arr',
            },
            {
              type: 'Indexer',
              nullSafeNavigation: true,
              index: {
                type: 'NumberLiteral',
                value: 0,
              },
            },
          ],
        },
        right: {
          type: 'NumberLiteral',
          value: 0,
        },
      },
    },
    right: {
      type: 'StringLiteral',
      value: 'fooc',
    },
  });
});

test('Parsing:  myfunc(")", x) ', (t) => {
  t.deepEqual(parse(' myfunc(")", x) '), {
    type: 'MethodReference',
    nullSafeNavigation: false,
    methodName: 'myfunc',
    args: [
      {
        type: 'StringLiteral',
        value: ')',
      },
      {
        type: 'PropertyReference',
        nullSafeNavigation: false,
        propertyName: 'x',
      },
    ],
  });
});

test('Parsing:  prop ', (t) => {
  t.deepEqual(parse(' prop '), {
    type: 'PropertyReference',
    nullSafeNavigation: false,
    propertyName: 'prop',
  });
});
test('Parsing: prop.![#this.foo + #this.bar.baz] ', (t) => {
  t.deepEqual(parse(' prop.![#this.foo + #this.bar.baz] '), {
    type: 'CompoundExpression',
    expressionComponents: [
      {
        type: 'PropertyReference',
        nullSafeNavigation: false,
        propertyName: 'prop',
      },
      {
        type: 'Projection',
        nullSafeNavigation: false,
        expression: {
          type: 'OpPlus',
          left: {
            type: 'CompoundExpression',
            expressionComponents: [
              {
                type: 'VariableReference',
                variableName: 'this',
              },
              {
                type: 'PropertyReference',
                nullSafeNavigation: false,
                propertyName: 'foo',
              },
            ],
          },
          right: {
            type: 'CompoundExpression',
            expressionComponents: [
              {
                type: 'VariableReference',
                variableName: 'this',
              },
              {
                type: 'PropertyReference',
                nullSafeNavigation: false,
                propertyName: 'bar',
              },
              {
                type: 'PropertyReference',
                nullSafeNavigation: false,
                propertyName: 'baz',
              },
            ],
          },
        },
      },
    ],
  });
});

test('Parsing: foo.bar.baz != null ? foo.bar.baz : null  ', (t) => {
  t.deepEqual(parse(' foo.bar.baz != null ? foo.bar.baz : null '), {
    type: 'Ternary',
    expression: {
      type: 'OpNE',
      left: {
        type: 'CompoundExpression',
        expressionComponents: [
          {
            type: 'PropertyReference',
            nullSafeNavigation: false,
            propertyName: 'foo',
          },
          {
            type: 'PropertyReference',
            nullSafeNavigation: false,
            propertyName: 'bar',
          },
          {
            type: 'PropertyReference',
            nullSafeNavigation: false,
            propertyName: 'baz',
          },
        ],
      },
      right: {
        type: 'NullLiteral',
      },
    },
    ifTrue: {
      type: 'CompoundExpression',
      expressionComponents: [
        {
          type: 'PropertyReference',
          nullSafeNavigation: false,
          propertyName: 'foo',
        },
        {
          type: 'PropertyReference',
          nullSafeNavigation: false,
          propertyName: 'bar',
        },
        {
          type: 'PropertyReference',
          nullSafeNavigation: false,
          propertyName: 'baz',
        },
      ],
    },
    ifFalse: {
      type: 'NullLiteral',
    },
  });
});

test('Parsing: arr?.![#this + 1]', (t) => {
  t.deepEqual(parse(' arr?.![#this + 1] '), {
    type: 'CompoundExpression',
    expressionComponents: [
      {
        type: 'PropertyReference',
        nullSafeNavigation: false,
        propertyName: 'arr',
      },
      {
        type: 'Projection',
        nullSafeNavigation: true,
        expression: {
          type: 'OpPlus',
          left: {
            type: 'VariableReference',
            variableName: 'this',
          },
          right: {
            type: 'NumberLiteral',
            value: 1,
          },
        },
      },
    ],
  });
});

test("Parsing: !(lookupEntityData('Provider', parentProviderId, 'hasMiisSa' ))", (t) => {
  t.deepEqual(
    parse("!(lookupEntityData('Provider', parentProviderId, 'hasMiisSa' ))"),
    {
      type: 'OpNot',
      expression: {
        type: 'MethodReference',
        nullSafeNavigation: false,
        methodName: 'lookupEntityData',
        args: [
          {
            type: 'StringLiteral',
            value: 'Provider',
          },
          {
            type: 'PropertyReference',
            nullSafeNavigation: false,
            propertyName: 'parentProviderId',
          },
          {
            type: 'StringLiteral',
            value: 'hasMiisSa',
          },
        ],
      },
    }
  );
});

test('Parsing:  foo() && arr?[0] > 0 || "fooc" ? arr?.![#this + 1] : null ', (t) => {
  t.deepEqual(
    parse(' foo() && arr?[0] > 0 || "fooc" ? arr?.![#this + 1] : null '),
    {
      type: 'Ternary',
      expression: {
        type: 'OpOr',
        left: {
          type: 'OpAnd',
          left: {
            type: 'MethodReference',
            nullSafeNavigation: false,
            methodName: 'foo',
            args: [],
          },
          right: {
            type: 'OpGT',
            left: {
              type: 'CompoundExpression',
              expressionComponents: [
                {
                  type: 'PropertyReference',
                  nullSafeNavigation: false,
                  propertyName: 'arr',
                },
                {
                  type: 'Indexer',
                  nullSafeNavigation: true,
                  index: {
                    type: 'NumberLiteral',
                    value: 0,
                  },
                },
              ],
            },
            right: {
              type: 'NumberLiteral',
              value: 0,
            },
          },
        },
        right: {
          type: 'StringLiteral',
          value: 'fooc',
        },
      },
      ifTrue: {
        type: 'CompoundExpression',
        expressionComponents: [
          {
            type: 'PropertyReference',
            nullSafeNavigation: false,
            propertyName: 'arr',
          },
          {
            type: 'Projection',
            nullSafeNavigation: true,
            expression: {
              type: 'OpPlus',
              left: {
                type: 'VariableReference',
                variableName: 'this',
              },
              right: {
                type: 'NumberLiteral',
                value: 1,
              },
            },
          },
        ],
      },
      ifFalse: {
        type: 'NullLiteral',
      },
    }
  );
});
