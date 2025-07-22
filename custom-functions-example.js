// Example of using custom functions with ts-spel whitelist security
const { parse, getEvaluator } = require('./lib/index.js');

// Example implementations of custom functions
const customFunctions = {
  // Date/Time functions
  FORMATDATE: (date, format) => {
    // Simple date formatter implementation
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString();
  },
  
  CURRENTDATE: () => new Date(),
  
  ADDDAYS: (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  },
  
  ADDMONTHS: (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  },
  
  DAYSDIF: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },
  
  DAY: (date) => new Date(date).getDate(),
  MONTH: (date) => new Date(date).getMonth() + 1,
  YEAR: (date) => new Date(date).getFullYear(),
  
  // Number functions
  FORMATNUMBER: (num, decimals = 2) => {
    return Number(num).toFixed(decimals);
  },
  
  CEIL: Math.ceil,
  FLOOR: Math.floor,
  ROUND: Math.round,
  
  INTEGER: (val) => parseInt(val, 10),
  DOUBLE: (val) => parseFloat(val),
  
  SUM: (...args) => args.reduce((a, b) => a + b, 0),
  MIN: (...args) => Math.min(...args),
  MAX: (...args) => Math.max(...args),
  
  // String functions
  FORMATSTRING: (template, ...args) => {
    let result = template;
    args.forEach((arg, i) => {
      result = result.replace(`{${i}}`, arg);
    });
    return result;
  },
  
  TO_STRING: (val) => String(val),
  
  CONTAINS: (str, substr) => str.includes(substr),
  NOTCONTAINS: (str, substr) => !str.includes(substr),
  
  // Logic functions
  EXISTS: (val) => val !== null && val !== undefined,
  NOTEXISTS: (val) => val === null || val === undefined,
  ISNULL: (val) => val === null,
  
  // Utility functions
  RANDOMUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  
  UUID: () => 'uuid-' + Date.now(),
  
  // Array function
  ARRAY: (...items) => items,
  
  // Text function
  T: (text) => text
};

// Example usage with whitelist enabled
console.log("=== Custom Functions with Whitelist Security ===\n");

const context = {
  order: {
    date: new Date('2024-01-15'),
    amount: 1234.567,
    items: ['apple', 'banana', 'orange']
  },
  user: {
    name: 'John Doe',
    birthDate: new Date('1990-05-20')
  }
};

// Create evaluator with whitelist enabled (default whitelist includes all these functions)
const evaluator = getEvaluator(context, customFunctions, { whitelist: true });

// Test various custom functions
const tests = [
  // Date functions
  '#CURRENTDATE()',
  '#FORMATDATE(order.date, "MM/DD/YYYY")',
  '#ADDDAYS(order.date, 30)',
  '#DAYSDIF(order.date, #CURRENTDATE())',
  '#YEAR(user.birthDate)',
  '#MONTH(order.date)',
  
  // Number functions
  '#FORMATNUMBER(order.amount, 2)',
  '#CEIL(order.amount)',
  '#FLOOR(order.amount)',
  '#ROUND(order.amount)',
  '#SUM(10, 20, 30, 40)',
  '#MIN(10, 20, 5, 30)',
  '#MAX(10, 20, 5, 30)',
  
  // String functions
  '#FORMATSTRING("Hello {0}, your order total is ${1}", user.name, order.amount)',
  '#TO_STRING(order.amount)',
  '#CONTAINS(user.name, "John")',
  
  // Logic functions
  '#EXISTS(user.name)',
  '#NOTEXISTS(user.email)',
  '#ISNULL(user.email)',
  
  // Utility functions
  '#RANDOMUUID()',
  '#ARRAY(1, 2, 3)',
  '#T("Static text")'
];

tests.forEach(expression => {
  try {
    const ast = parse(expression);
    const result = evaluator(ast);
    console.log(`✓ ${expression}`);
    console.log(`  Result: ${JSON.stringify(result)}\n`);
  } catch (error) {
    console.log(`✗ ${expression}`);
    console.log(`  Error: ${error.message}\n`);
  }
});

// Demonstrate that dangerous functions are still blocked
console.log("=== Security Still Active ===\n");

const dangerousTests = [
  'order.constructor',  // Blocked
  '#eval("alert(1)")',  // Function not in whitelist
  'order.__proto__'     // Blocked dangerous property
];

dangerousTests.forEach(expression => {
  try {
    const ast = parse(expression);
    const result = evaluator(ast);
    console.log(`✗ SECURITY BREACH: ${expression} was allowed!`);
  } catch (error) {
    console.log(`✓ Blocked: ${expression}`);
    console.log(`  Reason: ${error.message}\n`);
  }
});

console.log("=== Custom Whitelist Example ===\n");

// Example of creating a custom whitelist with only specific functions
const { SecurityWhitelist } = require('./lib/index.js');

const restrictedWhitelist = new SecurityWhitelist({
  allowedFunctions: new Set([
    'FORMATDATE',
    'CURRENTDATE',
    'ADDDAYS',
    'FORMATNUMBER',
    'SUM',
    'MIN',
    'MAX'
  ]),
  allowedProperties: new Set([
    'date',
    'amount',
    'order',
    'user',
    'name'
  ]),
  blockDangerousProperties: true
});

const restrictedEvaluator = getEvaluator(context, customFunctions, { 
  whitelist: restrictedWhitelist 
});

console.log("With restricted whitelist:");
try {
  // This will work
  const result1 = restrictedEvaluator(parse('#FORMATDATE(order.date)'));
  console.log("✓ Allowed: #FORMATDATE(order.date)");
  
  // This will be blocked (RANDOMUUID not in restricted list)
  const result2 = restrictedEvaluator(parse('#RANDOMUUID()'));
} catch (error) {
  console.log("✓ Blocked: #RANDOMUUID() - " + error.message);
}