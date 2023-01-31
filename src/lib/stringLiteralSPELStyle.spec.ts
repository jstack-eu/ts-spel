import stringLiteral from "./stringLiteralSPELStyle";

it("should match double-quoted string", () => {
  const input = '  "hello"  ';
  expect(stringLiteral(input)).toEqual(["hello", 9]);
});

it("should match double-quoted string and unescape ", () => {
  const input = ' "foo \'bar\' ""baz""  "  ';
  expect(stringLiteral(input)?.[0]).toEqual("foo 'bar' \"baz\"  ");
});

it("should match double-quoted string and deeply unescape ", () => {
  const input =
    ' "foo \'bar ""deepbar \\\'deeperbar\\\' deepbar"" bar\' ""baz""  "  ';
  expect(stringLiteral(input)?.[0]).toEqual(
    "foo 'bar \"deepbar \\'deeperbar\\' deepbar\" bar' \"baz\"  "
  );
});

it("should match single-quoted string", () => {
  const input = "  'hello'  ";
  expect(stringLiteral(input)).toEqual(["hello", 9]);
});

it("should match single-quoted string and unescape ", () => {
  const input = " 'foo \"bar\" ''baz''  '  ";
  expect(stringLiteral(input)?.[0]).toEqual("foo \"bar\" 'baz'  ");
});

it("should match single-quoted string and deeply unescape ", () => {
  const input =
    " 'foo \"bar ''deepbar \\\"deeperbar\\\" deepbar'' bar\" ''baz''  '  ";
  expect(stringLiteral(input)?.[0]).toEqual(
    "foo \"bar 'deepbar \\\"deeperbar\\\" deepbar' bar\" 'baz'  "
  );
});

it("should match even if escaped quote characters do not themselves close", () => {
  const input = " 'foo \"bar ''deepbar  '  ";
  expect(stringLiteral(input)?.[0]).toEqual("foo \"bar 'deepbar  ");

  const input2 = `'"'`;
  expect(stringLiteral(input2)?.[0]).toEqual('"');
});
