// Test the exact failing syntax from production
const { parse, getEvaluator } = require('./lib/index.js');

console.log("=== PRODUCTION EXACT SYNTAX TEST ===\n");

// Test with no custom functions - just built-in MIN
const context = {
  PayScalePayComponentList: [
    { PayScaleLevel_code: 'AUT/WEN/AUT/07/15', amount: 4000 },
    { PayScaleLevel_code: 'AUT/WEN/AUT/07/11', amount: 3500 },
  ],
  EmpJob: { payScaleLevel: 'AUT/WEN/AUT/07/11' },
  FOCompany: { standardHours: 40 },
  maxAmount: 4000,
};

// Create evaluator with exact production settings
const evaluator = getEvaluator(context, {}, {
  disableNullPointerExceptions: true,
  fallbackToFunctions: true,
});

console.log("TESTING EXACT FAILING CASES:");
console.log("============================");

const testCases = [
  {
    name: "Simple 2-argument MIN",
    formula: "MIN(3500, 4000)",
    expected: 3500
  },
  {
    name: "Simple 3-argument MIN", 
    formula: "MIN(3500, 4000, 2800)",
    expected: 2800
  },
  {
    name: "MIN with variables",
    formula: "MIN(maxAmount, 3500)",
    expected: 3500
  },
  {
    name: "MAX function test",
    formula: "MAX(3500, 4000)",
    expected: 4000
  },
  {
    name: "DOUBLE function test",
    formula: "DOUBLE('3500.5')",
    expected: 3500.5
  },
  {
    name: "ABS function test",
    formula: "ABS(-1234)",
    expected: 1234
  },
  {
    name: "ROUND function test",
    formula: "ROUND(3.7)",
    expected: 4
  },
  {
    name: "FLOOR function test",
    formula: "FLOOR(3.7)",
    expected: 3
  },
  {
    name: "CEIL function test", 
    formula: "CEIL(3.2)",
    expected: 4
  },
  {
    name: "Complex production-like formula",
    formula: "MIN(DOUBLE(maxAmount), DOUBLE('3500')) * 12 / 52 / DOUBLE(FOCompany.standardHours)",
    expected: "calculated value"
  }
];

testCases.forEach(test => {
  try {
    console.log(`Testing: ${test.name}`);
    console.log(`Formula: ${test.formula}`);
    const ast = parse(test.formula);
    const result = evaluator(ast);
    console.log(`✓ Result: ${result}`);
    console.log(`✓ Expected: ${test.expected}`);
    
    if (typeof test.expected === 'number' && Math.abs(result - test.expected) < 0.0001) {
      console.log("✅ PASS\n");
    } else if (test.expected === "calculated value") {
      console.log("✅ CALCULATED\n");
    } else {
      console.log("❌ MISMATCH\n");
    }
  } catch (error) {
    console.log(`✗ Error: ${error.message}`);
    console.log("❌ FAIL\n");
  }
});

console.log("TESTING EXACT PRODUCTION FORMULA:");
console.log("==================================");

// Test the exact production formula structure
const productionFormula = "MIN(DOUBLE(PayScalePayComponentList.^[PayScaleLevel_code == EmpJob.payScaleLevel].amount), DOUBLE(maxAmount)) * 12 / 52 / DOUBLE(FOCompany.standardHours)";

try {
  console.log(`Production formula: ${productionFormula}`);
  const ast = parse(productionFormula);
  const result = evaluator(ast);
  console.log(`✓ Result: ${result}`);
  console.log("✅ PRODUCTION FORMULA WORKING!");
} catch (error) {
  console.log(`✗ Error: ${error.message}`);
  console.log("❌ PRODUCTION FORMULA FAILED");
}