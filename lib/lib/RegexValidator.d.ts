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
export declare class RegexValidator {
    private options;
    constructor(options?: RegexValidationOptions);
    /**
     * Validates a regex pattern for potential ReDoS vulnerabilities
     * @throws Error if pattern is potentially dangerous
     */
    validatePattern(pattern: string): void;
    /**
     * Checks for known dangerous regex patterns that can cause ReDoS
     */
    private checkForDangerousPatterns;
    /**
     * Validates quantifier usage to prevent excessive repetition
     */
    private validateQuantifiers;
    /**
     * Validates group nesting depth
     */
    private validateGroupDepth;
    /**
     * Tests a regex pattern with timeout to prevent hanging
     */
    testWithTimeout(pattern: string, testString: string): Promise<boolean>;
}
export declare const defaultRegexValidator: RegexValidator;
export declare function createLenientRegexValidator(): RegexValidator;
export declare function createStrictRegexValidator(): RegexValidator;
/**
 * Safe regex compilation wrapper
 */
export declare function safeCompileRegex(pattern: string, validator?: RegexValidator): (input: string) => boolean;
