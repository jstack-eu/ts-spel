import test from 'ava';

import stringLiteral from './stringLiteral';

test('should match double-quoted string', (t) => {
  const input = '  "hello"  ';
  t.deepEqual(stringLiteral(input), ['hello', 9]);
});

test('should match double-quoted string and unescape ', (t) => {
  const input = ' "foo \'bar\' \\"baz\\"  "  ';
  t.is(stringLiteral(input)[0], 'foo \'bar\' "baz"  ');
});

test('should match double-quoted string and deeply unescape ', (t) => {
  const input =
    ' "foo \'bar \\"deepbar \\\'deeperbar\\\' deepbar\\" bar\' \\"baz\\"  "  ';
  t.is(
    stringLiteral(input)[0],
    'foo \'bar "deepbar \\\'deeperbar\\\' deepbar" bar\' "baz"  '
  );
});

test('should match single-quoted string', (t) => {
  const input = "  'hello'  ";
  t.deepEqual(stringLiteral(input), ['hello', 9]);
});

test('should match single-quoted string and unescape ', (t) => {
  const input = " 'foo \"bar\" \\'baz\\'  '  ";
  t.is(stringLiteral(input)[0], 'foo "bar" \'baz\'  ');
});

test('should match single-quoted string and deeply unescape ', (t) => {
  const input =
    " 'foo \"bar \\'deepbar \\\"deeperbar\\\" deepbar\\' bar\" \\'baz\\'  '  ";
  t.is(
    stringLiteral(input)[0],
    'foo "bar \'deepbar \\"deeperbar\\" deepbar\' bar" \'baz\'  '
  );
});
