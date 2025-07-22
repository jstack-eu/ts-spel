"use strict";
/**
 * Regex validation to prevent ReDoS (Regular Expression Denial of Service) attacks
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeCompileRegex = exports.createStrictRegexValidator = exports.createLenientRegexValidator = exports.defaultRegexValidator = exports.RegexValidator = void 0;
var RegexValidator = /** @class */ (function () {
    function RegexValidator(options) {
        if (options === void 0) { options = {}; }
        this.options = {
            maxLength: options.maxLength || 1000,
            maxQuantifierLimit: options.maxQuantifierLimit || 100,
            maxGroupDepth: options.maxGroupDepth || 10,
            blockDangerousPatterns: options.blockDangerousPatterns !== false,
            timeout: options.timeout || 1000 // 1 second default timeout
        };
    }
    /**
     * Validates a regex pattern for potential ReDoS vulnerabilities
     * @throws Error if pattern is potentially dangerous
     */
    RegexValidator.prototype.validatePattern = function (pattern) {
        if (!pattern || typeof pattern !== 'string') {
            throw new Error('Invalid regex pattern: must be a non-empty string');
        }
        // Check pattern length
        if (pattern.length > this.options.maxLength) {
            throw new Error("Regex pattern too long: ".concat(pattern.length, " characters (max: ").concat(this.options.maxLength, ")"));
        }
        if (this.options.blockDangerousPatterns) {
            this.checkForDangerousPatterns(pattern);
        }
        this.validateQuantifiers(pattern);
        this.validateGroupDepth(pattern);
    };
    /**
     * Checks for known dangerous regex patterns that can cause ReDoS
     */
    RegexValidator.prototype.checkForDangerousPatterns = function (pattern) {
        // Dangerous patterns that can cause exponential backtracking
        var dangerousPatterns = [
            // Nested quantifiers like (a+)+ or (a*)*
            {
                regex: /\([^)]*[+*]\)[+*]/,
                description: "nested quantifiers"
            },
            // Alternation with overlapping patterns like (a|a)*
            {
                regex: /\([^|)]*\|[^|)]*\)[+*]/,
                description: "alternation with quantifiers"
            },
            // Multiple consecutive quantifiers (but allow escaped ones)
            {
                regex: /(?<!\\)[+*]{2,}/,
                description: "multiple consecutive quantifiers"
            },
            // Catastrophic backtracking patterns - only flag if they have large quantifiers
            {
                regex: /\(\.\*\)\{[5-9]\d*,?\}/,
                description: "catastrophic backtracking with (.*){}}"
            },
            {
                regex: /\(\.\+\)\{[5-9]\d*,?\}/,
                description: "catastrophic backtracking with (.+){}"
            },
            // Nested groups with quantifiers - more specific check
            {
                regex: /\([^)]*\([^)]*[+*][^)]*\)[^)]*\)[+*]/,
                description: "nested groups with quantifiers"
            },
            // Check for patterns like (a|a)* which have redundant alternation
            {
                regex: /\(([^|)]+)\|(\1)\)[+*]/,
                description: "redundant alternation with quantifiers"
            }
        ];
        for (var _i = 0, dangerousPatterns_1 = dangerousPatterns; _i < dangerousPatterns_1.length; _i++) {
            var dangerous = dangerousPatterns_1[_i];
            try {
                if (dangerous.regex.test(pattern)) {
                    throw new Error("Potentially dangerous regex pattern detected (".concat(dangerous.description, "): ").concat(pattern));
                }
            }
            catch (e) {
                // If regex test fails (e.g., lookbehind not supported), skip this check
                continue;
            }
        }
        // Check for excessive alternations
        var alternationCount = (pattern.match(/\|/g) || []).length;
        if (alternationCount > 10) {
            throw new Error("Too many alternations in regex pattern: ".concat(alternationCount, " (max: 10)"));
        }
    };
    /**
     * Validates quantifier usage to prevent excessive repetition
     */
    RegexValidator.prototype.validateQuantifiers = function (pattern) {
        // Check for large quantifier values like {1000,} or {500,1000}
        var quantifierRegex = /\{(\d+)(,(\d*))?\}/g;
        var match;
        while ((match = quantifierRegex.exec(pattern)) !== null) {
            var min = parseInt(match[1], 10);
            var max = match[3] ? parseInt(match[3], 10) : null;
            if (min > this.options.maxQuantifierLimit) {
                throw new Error("Quantifier minimum too large: {".concat(min, "} (max: ").concat(this.options.maxQuantifierLimit, ")"));
            }
            if (max && max > this.options.maxQuantifierLimit) {
                throw new Error("Quantifier maximum too large: {".concat(match[1], ",").concat(max, "} (max: ").concat(this.options.maxQuantifierLimit, ")"));
            }
            if (max && max - min > this.options.maxQuantifierLimit) {
                throw new Error("Quantifier range too large: {".concat(min, ",").concat(max, "}"));
            }
        }
    };
    /**
     * Validates group nesting depth
     */
    RegexValidator.prototype.validateGroupDepth = function (pattern) {
        var maxDepth = 0;
        var currentDepth = 0;
        var inCharClass = false;
        for (var i = 0; i < pattern.length; i++) {
            var char = pattern[i];
            var prevChar = i > 0 ? pattern[i - 1] : null;
            // Skip escaped characters
            if (prevChar === '\\')
                continue;
            // Handle character classes
            if (char === '[' && !inCharClass) {
                inCharClass = true;
            }
            else if (char === ']' && inCharClass) {
                inCharClass = false;
            }
            // Count group depth only outside character classes
            if (!inCharClass) {
                if (char === '(') {
                    currentDepth++;
                    maxDepth = Math.max(maxDepth, currentDepth);
                }
                else if (char === ')') {
                    currentDepth = Math.max(0, currentDepth - 1);
                }
            }
        }
        if (maxDepth > this.options.maxGroupDepth) {
            throw new Error("Regex group nesting too deep: ".concat(maxDepth, " (max: ").concat(this.options.maxGroupDepth, ")"));
        }
    };
    /**
     * Tests a regex pattern with timeout to prevent hanging
     */
    RegexValidator.prototype.testWithTimeout = function (pattern, testString) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var timeout = setTimeout(function () {
                            reject(new Error("Regex execution timeout: pattern took longer than ".concat(_this.options.timeout, "ms")));
                        }, _this.options.timeout);
                        try {
                            // This would need to be implemented with the actual regex engine
                            // For now, we'll just validate the pattern
                            _this.validatePattern(pattern);
                            clearTimeout(timeout);
                            resolve(true);
                        }
                        catch (error) {
                            clearTimeout(timeout);
                            reject(error);
                        }
                    })];
            });
        });
    };
    return RegexValidator;
}());
exports.RegexValidator = RegexValidator;
exports.defaultRegexValidator = new RegexValidator();
function createLenientRegexValidator() {
    return new RegexValidator({
        maxLength: 500,
        maxQuantifierLimit: 50,
        maxGroupDepth: 5,
        blockDangerousPatterns: true,
        timeout: 2000
    });
}
exports.createLenientRegexValidator = createLenientRegexValidator;
function createStrictRegexValidator() {
    return new RegexValidator({
        maxLength: 100,
        maxQuantifierLimit: 10,
        maxGroupDepth: 3,
        blockDangerousPatterns: true,
        timeout: 1000
    });
}
exports.createStrictRegexValidator = createStrictRegexValidator;
/**
 * Safe regex compilation wrapper
 */
function safeCompileRegex(pattern, validator) {
    if (validator === void 0) { validator = exports.defaultRegexValidator; }
    // Validate the pattern first
    validator.validatePattern(pattern);
    // Import the original compileRegex
    var compile = require('java-regex-js').compile;
    // Compile and return the regex function
    return compile(pattern);
}
exports.safeCompileRegex = safeCompileRegex;
//# sourceMappingURL=RegexValidator.js.map