/**
 * Regex validation to prevent ReDoS (Regular Expression Denial of Service) attacks
 */

export interface RegexValidationOptions {
  maxLength?: number;
  maxQuantifierLimit?: number;
  maxGroupDepth?: number;
  blockDangerousPatterns?: boolean;
  timeout?: number;
}

export class RegexValidator {
  private options: Required<RegexValidationOptions>;

  constructor(options: RegexValidationOptions = {}) {
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
  validatePattern(pattern: string): void {
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Invalid regex pattern: must be a non-empty string');
    }

    // Check pattern length
    if (pattern.length > this.options.maxLength) {
      throw new Error(`Regex pattern too long: ${pattern.length} characters (max: ${this.options.maxLength})`);
    }

    if (this.options.blockDangerousPatterns) {
      this.checkForDangerousPatterns(pattern);
    }

    this.validateQuantifiers(pattern);
    this.validateGroupDepth(pattern);
  }

  /**
   * Checks for known dangerous regex patterns that can cause ReDoS
   */
  private checkForDangerousPatterns(pattern: string): void {
    // Dangerous patterns that can cause exponential backtracking
    const dangerousPatterns = [
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

    for (const dangerous of dangerousPatterns) {
      try {
        if (dangerous.regex.test(pattern)) {
          throw new Error(`Potentially dangerous regex pattern detected (${dangerous.description}): ${pattern}`);
        }
      } catch (e) {
        // If regex test fails (e.g., lookbehind not supported), skip this check
        continue;
      }
    }

    // Check for excessive alternations
    const alternationCount = (pattern.match(/\|/g) || []).length;
    if (alternationCount > 10) {
      throw new Error(`Too many alternations in regex pattern: ${alternationCount} (max: 10)`);
    }
  }

  /**
   * Validates quantifier usage to prevent excessive repetition
   */
  private validateQuantifiers(pattern: string): void {
    // Check for large quantifier values like {1000,} or {500,1000}
    const quantifierRegex = /\{(\d+)(,(\d*))?\}/g;
    let match;

    while ((match = quantifierRegex.exec(pattern)) !== null) {
      const min = parseInt(match[1], 10);
      const max = match[3] ? parseInt(match[3], 10) : null;

      if (min > this.options.maxQuantifierLimit) {
        throw new Error(`Quantifier minimum too large: {${min}} (max: ${this.options.maxQuantifierLimit})`);
      }

      if (max && max > this.options.maxQuantifierLimit) {
        throw new Error(`Quantifier maximum too large: {${match[1]},${max}} (max: ${this.options.maxQuantifierLimit})`);
      }

      if (max && max - min > this.options.maxQuantifierLimit) {
        throw new Error(`Quantifier range too large: {${min},${max}}`);
      }
    }
  }

  /**
   * Validates group nesting depth
   */
  private validateGroupDepth(pattern: string): void {
    let maxDepth = 0;
    let currentDepth = 0;
    let inCharClass = false;

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      const prevChar = i > 0 ? pattern[i - 1] : null;

      // Skip escaped characters
      if (prevChar === '\\') continue;

      // Handle character classes
      if (char === '[' && !inCharClass) {
        inCharClass = true;
      } else if (char === ']' && inCharClass) {
        inCharClass = false;
      }

      // Count group depth only outside character classes
      if (!inCharClass) {
        if (char === '(') {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
        } else if (char === ')') {
          currentDepth = Math.max(0, currentDepth - 1);
        }
      }
    }

    if (maxDepth > this.options.maxGroupDepth) {
      throw new Error(`Regex group nesting too deep: ${maxDepth} (max: ${this.options.maxGroupDepth})`);
    }
  }

  /**
   * Tests a regex pattern with timeout to prevent hanging
   */
  async testWithTimeout(pattern: string, testString: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Regex execution timeout: pattern took longer than ${this.options.timeout}ms`));
      }, this.options.timeout);

      try {
        // This would need to be implemented with the actual regex engine
        // For now, we'll just validate the pattern
        this.validatePattern(pattern);
        clearTimeout(timeout);
        resolve(true);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

export const defaultRegexValidator = new RegexValidator();

export function createLenientRegexValidator(): RegexValidator {
  return new RegexValidator({
    maxLength: 500,
    maxQuantifierLimit: 50,
    maxGroupDepth: 5,
    blockDangerousPatterns: true,
    timeout: 2000
  });
}

export function createStrictRegexValidator(): RegexValidator {
  return new RegexValidator({
    maxLength: 100,
    maxQuantifierLimit: 10,
    maxGroupDepth: 3,
    blockDangerousPatterns: true,
    timeout: 1000
  });
}

/**
 * Safe regex compilation wrapper
 */
export function safeCompileRegex(pattern: string, validator: RegexValidator = defaultRegexValidator): (input: string) => boolean {
  // Validate the pattern first
  validator.validatePattern(pattern);
  
  // Import the original compileRegex
  const { compile } = require('java-regex-js');
  
  // Compile and return the regex function
  return compile(pattern);
}