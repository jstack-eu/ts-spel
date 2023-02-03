import { CustomError } from "ts-custom-error";
import { Ast } from "./Ast";

export class ParsingError extends CustomError {
  public constructor(
    public expression: string,
    public index: number,
    public reason:
      | "Unclosed Paren"
      | "Expression Remaining"
      | "Generic"
      | "Expected expression after elvis (?:)"
      | "Unclosed function call"
      | "Unclosed method call"
      | "No right operand for &&"
      | "No right operand for ||"
      | "No right operand for >="
      | "No right operand for >"
      | "No right operand for <="
      | "No right operand for <"
      | "No right operand for !="
      | "No right operand for =="
      | "No right operand for *"
      | "No right operand for /"
      | "No right operand for %"
      | "No right operand for 'matches'"
      | "No right operand for 'between'"
      | "No left operand for &&"
      | "No left operand for ||"
      | "No left operand for >="
      | "No left operand for >"
      | "No left operand for <="
      | "No left operand for <"
      | "No left operand for !="
      | "No left operand for =="
      | "No left operand for *"
      | "No left operand for /"
      | "No left operand for %"
      | "Assignment not allowed"
      | "Incomplete Ternary"
      | "Not an Operator"
      | "Missing Character &"
      | "Missing Character |"
      | "Non-terminating quoted string"
      | "Unclosed {"
      | "Unclosed ["
      | "Unclosed Selection Expression ?["
      | "Unclosed SelectionFirst Expression ^["
      | "Unclosed SelectionLast Expression $["
      | "Unclosed Projection Expression ![",
    message: string = reason,
    cause?: Error
  ) {
    super(message, { cause });
  }
}

export class RuntimeError extends CustomError {
  public constructor(public ast: Ast, message?: string, cause?: Error) {
    super(message, { cause });
  }
}

export class UnexpectedError extends CustomError {
  public constructor(message?: string, cause?: Error) {
    super(message, { cause });
  }
}

export type TsSpelError = ParsingError | RuntimeError | UnexpectedError;
