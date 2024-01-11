import stringLiteral from "./stringLiteralSPELStyle";

it("should match double-quoted empty string", () => {
  const input = '""';
  expect(stringLiteral(input)).toEqual(["", 2]);
});

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

it("Should optionally handle nonstandard quote chars", () => {
  const input = "  ‘mystr’  ";
  expect(stringLiteral(input, false)).toBeNull();
  expect(stringLiteral(input, true)?.[0]).toEqual("mystr");

  const input2 = "  ‘ '' “” ’  ";
  expect(stringLiteral(input2, false)).toBeNull();
  expect(stringLiteral(input2, true)?.[0]).toEqual(" '' “” ");

  // Now let's make sure it works with double left quotes.
  const input3 = "  ‘ '' “” ‘  ";
  expect(stringLiteral(input3, false)).toBeNull();
  expect(stringLiteral(input3, true)?.[0]).toEqual(" '' “” ");

  const input4 = `  “ '' "" ”  `;
  expect(stringLiteral(input4, false)).toBeNull();
  expect(stringLiteral(input4, true)?.[0]).toEqual(` '' "" `);

  const input5 = `  “ '' "" “  `;
  expect(stringLiteral(input5, false)).toBeNull();
  expect(stringLiteral(input5, true)?.[0]).toEqual(` '' "" `);
});
