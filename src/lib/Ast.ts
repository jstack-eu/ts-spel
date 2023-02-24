export type Ast =
  | {
      type: "StringLiteral";
      value: string;
    }
  | {
      type: "Ternary";
      expression: Ast;
      ifTrue: Ast;
      ifFalse: Ast;
    }
  | {
      type: "VariableReference";
      variableName: string;
    }
  | {
      type: "SelectionFirst";
      nullSafeNavigation: boolean;
      expression: Ast;
      __unclosed?: true;
    }
  | {
      type: "SelectionLast";
      nullSafeNavigation: boolean;
      expression: Ast;
      __unclosed?: true;
    }
  | {
      type: "SelectionAll";
      nullSafeNavigation: boolean;
      expression: Ast;
      __unclosed?: true;
    }
  | {
      type: "PropertyReference";
      nullSafeNavigation: boolean;
      propertyName: string;
    }
  | {
      type: "Projection";
      nullSafeNavigation: boolean;
      expression: Ast;
      __unclosed?: true;
    }
  | {
      type: "OpPower";
      base: Ast;
      expression: Ast;
    }
  | {
      type: "OpPlus";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpOr";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpNot";
      expression: Ast;
    }
  | {
      type: "OpNE";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpMultiply";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpModulus";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpMinus";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpMatches";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpBetween";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpLT";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpLE";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpGT";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpGE";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpEQ";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpDivide";
      left: Ast;
      right: Ast;
    }
  | {
      type: "OpAnd";
      left: Ast;
      right: Ast;
    }
  | {
      type: "Negative";
      value: Ast;
    }
  | {
      type: "NumberLiteral";
      value: number;
    }
  | {
      type: "NullLiteral";
    }
  | {
      type: "MethodReference";
      nullSafeNavigation: boolean;
      methodName: string;
      args: Ast[];
      __unclosed?: true;
    }
  | {
      type: "FunctionReference";
      nullSafeNavigation: boolean;
      functionName: string;
      args: Ast[];
      __unclosed?: true;
    }
  | {
      type: "InlineMap";
      elements: {
        [elem: string]: Ast;
      };
      __unclosed?: true;
    }
  | {
      type: "InlineList";
      elements: Ast[];
      __unclosed?: true;
    }
  | {
      type: "Indexer";
      nullSafeNavigation: boolean;
      index: Ast;
      __unclosed?: true;
    }
  | {
      type: "Elvis";
      expression: Ast;
      ifFalse: Ast;
    }
  | {
      // Represents a dot-separated expression sequence, such as 'property1.property2.methodOne()'
      type: "CompoundExpression";
      expressionComponents: Ast[];
    }
  | {
      type: "BooleanLiteral";
      value: boolean;
    };
