/**
 * Security whitelist configuration for ts-spel
 * Prevents arbitrary code execution by restricting function calls and property access
 */
var DANGEROUS_PROPERTIES = new Set([
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
    'eval',
    'Function',
    'require',
    'process',
    'global',
    'module',
    'exports'
]);
var DANGEROUS_GLOBAL_FUNCTIONS = new Set([
    'eval',
    'Function',
    'require',
    'setImmediate',
    'setTimeout',
    'setInterval',
    'process'
]);
var SENSITIVE_OBJECTS = new Set([
    'process',
    'global',
    'globalThis',
    'window',
    'document',
    'console',
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    'Buffer'
]);
var SENSITIVE_OBJECT_TYPES = new Set([
    'process',
    'global',
    'Module',
    'Buffer'
]);
var SecurityWhitelist = /** @class */ (function () {
    function SecurityWhitelist(config) {
        if (config === void 0) { config = {}; }
        this.callDepth = 0;
        this.propertyChainDepth = 0;
        this.config = {
            allowedFunctions: config.allowedFunctions || new Set(),
            allowedProperties: config.allowedProperties || new Set(),
            allowedMethods: config.allowedMethods || new Map(),
            blockDangerousProperties: config.blockDangerousProperties !== false,
            maxCallDepth: config.maxCallDepth || 100,
            maxPropertyChainDepth: config.maxPropertyChainDepth || 10,
            blockSensitiveObjects: config.blockSensitiveObjects !== false
        };
    }
    SecurityWhitelist.prototype.isPropertyAllowed = function (propertyName) {
        if (this.config.blockDangerousProperties && DANGEROUS_PROPERTIES.has(propertyName)) {
            return false;
        }
        if (this.config.allowedProperties.size === 0) {
            return !DANGEROUS_PROPERTIES.has(propertyName);
        }
        return this.config.allowedProperties.has(propertyName);
    };
    SecurityWhitelist.prototype.isFunctionAllowed = function (functionName) {
        if (DANGEROUS_GLOBAL_FUNCTIONS.has(functionName)) {
            return false;
        }
        if (this.config.allowedFunctions.size === 0) {
            return true;
        }
        return this.config.allowedFunctions.has(functionName);
    };
    SecurityWhitelist.prototype.isMethodAllowed = function (objectType, methodName) {
        if (this.config.blockDangerousProperties && DANGEROUS_PROPERTIES.has(methodName)) {
            return false;
        }
        var allowedForType = this.config.allowedMethods.get(objectType);
        if (!allowedForType) {
            return false;
        }
        return allowedForType.has(methodName) || allowedForType.has('*');
    };
    SecurityWhitelist.prototype.enterCall = function () {
        this.callDepth++;
        if (this.callDepth > this.config.maxCallDepth) {
            throw new Error("Maximum call depth exceeded: ".concat(this.config.maxCallDepth));
        }
    };
    SecurityWhitelist.prototype.exitCall = function () {
        this.callDepth--;
    };
    SecurityWhitelist.prototype.enterPropertyChain = function () {
        this.propertyChainDepth++;
        if (this.propertyChainDepth > this.config.maxPropertyChainDepth) {
            throw new Error("Maximum property chain depth exceeded: ".concat(this.config.maxPropertyChainDepth));
        }
    };
    SecurityWhitelist.prototype.exitPropertyChain = function () {
        this.propertyChainDepth = Math.max(0, this.propertyChainDepth - 1);
    };
    SecurityWhitelist.prototype.resetPropertyChain = function () {
        this.propertyChainDepth = 0;
    };
    Object.defineProperty(SecurityWhitelist.prototype, "currentPropertyChainDepth", {
        get: function () {
            return this.propertyChainDepth;
        },
        enumerable: false,
        configurable: true
    });
    SecurityWhitelist.prototype.validatePropertyAccess = function (propertyName) {
        if (!this.isPropertyAllowed(propertyName)) {
            throw new Error("Access to property '".concat(propertyName, "' is not allowed"));
        }
    };
    SecurityWhitelist.prototype.validateFunctionCall = function (functionName) {
        if (!this.isFunctionAllowed(functionName)) {
            throw new Error("Call to function '".concat(functionName, "' is not allowed"));
        }
    };
    SecurityWhitelist.prototype.validateMethodCall = function (object, methodName) {
        if (!this.isPropertyAllowed(methodName)) {
            throw new Error("Access to method '".concat(methodName, "' is not allowed"));
        }
        this.validateObjectAccess(object);
        var objectType = this.getObjectType(object);
        if (this.config.allowedMethods.size > 0 && !this.isMethodAllowed(objectType, methodName)) {
            // Allow fallback to function whitelist for custom functions
            if (!this.isFunctionAllowed(methodName)) {
                throw new Error("Call to method '".concat(methodName, "' on ").concat(objectType, " is not allowed"));
            }
        }
    };
    SecurityWhitelist.prototype.validateObjectAccess = function (obj) {
        if (this.config.blockSensitiveObjects) {
            this.checkForSensitiveObject(obj);
        }
    };
    SecurityWhitelist.prototype.checkForSensitiveObject = function (obj) {
        if (obj === null || obj === undefined) {
            return;
        }
        // Check if object is a sensitive global object
        if (obj === global || obj === globalThis || obj === process) {
            throw new Error('Access to sensitive global objects is not allowed');
        }
        // Check constructor name for sensitive types
        if (obj.constructor && obj.constructor.name) {
            if (SENSITIVE_OBJECT_TYPES.has(obj.constructor.name)) {
                throw new Error("Access to sensitive object type '".concat(obj.constructor.name, "' is not allowed"));
            }
        }
        // Check for Node.js specific objects
        if (typeof obj === 'object') {
            // Check for process object properties
            if (obj.hasOwnProperty && obj.hasOwnProperty('pid') && obj.hasOwnProperty('platform')) {
                throw new Error('Access to process-like objects is not allowed');
            }
            // Check for module objects
            if (obj.hasOwnProperty && (obj.hasOwnProperty('exports') || obj.hasOwnProperty('require'))) {
                throw new Error('Access to module-like objects is not allowed');
            }
            // Check for Buffer objects
            if (obj.constructor && obj.constructor.name === 'Buffer') {
                throw new Error('Access to Buffer objects is not allowed');
            }
        }
    };
    SecurityWhitelist.prototype.getObjectType = function (obj) {
        if (obj === null)
            return 'null';
        if (obj === undefined)
            return 'undefined';
        if (Array.isArray(obj))
            return 'Array';
        if (obj instanceof Date)
            return 'Date';
        if (obj instanceof RegExp)
            return 'RegExp';
        if (obj instanceof Map)
            return 'Map';
        if (obj instanceof Set)
            return 'Set';
        if (typeof obj === 'string')
            return 'String';
        if (typeof obj === 'number')
            return 'Number';
        if (typeof obj === 'boolean')
            return 'Boolean';
        if (typeof obj === 'function')
            return 'Function';
        return 'Object';
    };
    return SecurityWhitelist;
}());
export { SecurityWhitelist };
export function createDefaultWhitelist() {
    return new SecurityWhitelist({
        allowedFunctions: new Set([
            // JavaScript built-ins
            'parseInt',
            'parseFloat',
            'isNaN',
            'isFinite',
            'encodeURI',
            'encodeURIComponent',
            'decodeURI',
            'decodeURIComponent',
            // Date/Time functions
            'FORMATDATE',
            'AGE',
            'EDATE',
            'ADDDAYS',
            'ADDWEEKS',
            'ADDMONTHS',
            'ADDYEARS',
            'SUBTRACTDAYS',
            'SUBTRACTWEEKS',
            'SUBTRACTMONTHS',
            'SUBTRACTYEARS',
            'DAYSDIF',
            'DAYSDIFF',
            'MONTHSDIF',
            'ENDOFMONTH',
            'STARTOFMONTH',
            'YEARMONTH',
            'TIMESTAMP',
            'DAY',
            'MONTH',
            'YEAR',
            'DATE',
            'CURRENTDATE',
            'YEARFRAC',
            'isLeapYear',
            // Number functions
            'FORMATNUMBER',
            'CEIL',
            'FLOOR',
            'INTEGER',
            'DOUBLE',
            'ROUND',
            'SUM',
            'MIN',
            'MAX',
            // String functions
            'FORMATSTRING',
            'TO_STRING',
            'CONTAINS',
            'NOTCONTAINS',
            'T',
            // Logic functions
            'EXISTS',
            'NOTEXISTS',
            'ISNULL',
            'ISNOTNULL',
            'GET',
            'get',
            'add',
            'date',
            'COALESCE',
            'DEFAULT',
            // Utility functions
            'RANDOMUUID',
            'UUID',
            'UUIDF',
            'ARRAY'
        ]),
        allowedMethods: new Map([
            ['String', new Set([
                    'charAt', 'charCodeAt', 'concat', 'includes', 'indexOf',
                    'lastIndexOf', 'match', 'matches', 'padEnd', 'padStart', 'repeat',
                    'replace', 'search', 'slice', 'split', 'substring',
                    'toLowerCase', 'toUpperCase', 'trim', 'trimEnd', 'trimStart',
                    'length', 'toString', 'valueOf', 'localeCompare',
                    'startsWith', 'endsWith', 'normalize'
                ])],
            ['Number', new Set([
                    'toFixed', 'toExponential', 'toPrecision', 'toString',
                    'valueOf', 'toLocaleString'
                ])],
            ['Array', new Set([
                    'concat', 'every', 'filter', 'find', 'findIndex',
                    'forEach', 'includes', 'indexOf', 'join', 'lastIndexOf',
                    'map', 'reduce', 'reduceRight', 'reverse', 'slice',
                    'some', 'sort', 'length', 'toString', 'flat', 'flatMap'
                ])],
            ['Date', new Set([
                    'getDate', 'getDay', 'getFullYear', 'getHours',
                    'getMilliseconds', 'getMinutes', 'getMonth', 'getSeconds',
                    'getTime', 'getTimezoneOffset', 'getUTCDate', 'getUTCDay',
                    'getUTCFullYear', 'getUTCHours', 'getUTCMilliseconds',
                    'getUTCMinutes', 'getUTCMonth', 'getUTCSeconds',
                    'toDateString', 'toISOString', 'toJSON', 'toLocaleDateString',
                    'toLocaleString', 'toLocaleTimeString', 'toString',
                    'toTimeString', 'toUTCString', 'valueOf'
                ])],
            ['Math', new Set([
                    'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atanh',
                    'atan2', 'ceil', 'cbrt', 'clz32', 'cos', 'cosh', 'exp',
                    'expm1', 'floor', 'fround', 'hypot', 'imul', 'log', 'log1p',
                    'log10', 'log2', 'max', 'min', 'pow', 'random', 'round',
                    'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc',
                    'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2'
                ])],
            ['Object', new Set([
                    'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
                    'toString', 'valueOf', 'toLocaleString'
                ])]
        ]),
        blockDangerousProperties: true,
        maxCallDepth: 100,
        maxPropertyChainDepth: 10,
        blockSensitiveObjects: true
    });
}
export function createStrictWhitelist() {
    return new SecurityWhitelist({
        allowedFunctions: new Set([
            'parseInt',
            'parseFloat'
        ]),
        allowedProperties: new Set([
            // Common data properties
            'length',
            'name',
            'value',
            'id',
            'type',
            'data',
            'items',
            'count',
            'total',
            'status',
            'message',
            // Allow common top-level context properties
            'user',
            'users',
            'item',
            'items',
            'post',
            'posts',
            'product',
            'products',
            'order',
            'orders',
            'customer',
            'customers'
        ]),
        allowedMethods: new Map([
            ['String', new Set([
                    'charAt', 'indexOf', 'substring', 'toLowerCase',
                    'toUpperCase', 'trim', 'length', 'toString'
                ])],
            ['Number', new Set([
                    'toFixed', 'toString'
                ])],
            ['Array', new Set([
                    'length', 'filter', 'map', 'find', 'includes'
                ])],
            ['Date', new Set([
                    'getTime', 'toISOString'
                ])],
            ['Object', new Set([
                    'toString'
                ])]
        ]),
        blockDangerousProperties: true,
        maxCallDepth: 50
    });
}
//# sourceMappingURL=SecurityWhitelist.js.map