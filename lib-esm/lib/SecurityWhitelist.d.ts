/**
 * Security whitelist configuration for ts-spel
 * Prevents arbitrary code execution by restricting function calls and property access
 */
export interface WhitelistConfig {
    allowedFunctions?: Set<string>;
    allowedProperties?: Set<string>;
    allowedMethods?: Map<string, Set<string>>;
    blockDangerousProperties?: boolean;
    maxCallDepth?: number;
    maxPropertyChainDepth?: number;
    blockSensitiveObjects?: boolean;
}
export declare class SecurityWhitelist {
    private config;
    private callDepth;
    private propertyChainDepth;
    constructor(config?: WhitelistConfig);
    isPropertyAllowed(propertyName: string): boolean;
    isFunctionAllowed(functionName: string): boolean;
    isMethodAllowed(objectType: string, methodName: string): boolean;
    enterCall(): void;
    exitCall(): void;
    enterPropertyChain(): void;
    exitPropertyChain(): void;
    resetPropertyChain(): void;
    get currentPropertyChainDepth(): number;
    validatePropertyAccess(propertyName: string): void;
    validateFunctionCall(functionName: string): void;
    validateMethodCall(object: unknown, methodName: string): void;
    validateObjectAccess(obj: unknown): void;
    private checkForSensitiveObject;
    private getObjectType;
}
export declare function createDefaultWhitelist(): SecurityWhitelist;
export declare function createStrictWhitelist(): SecurityWhitelist;
