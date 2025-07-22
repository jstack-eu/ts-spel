var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { CustomError } from "ts-custom-error";
var ParsingError = /** @class */ (function (_super) {
    __extends(ParsingError, _super);
    function ParsingError(expression, index, reason, message, cause) {
        if (message === void 0) { message = reason; }
        var _this = _super.call(this, message, { cause: cause }) || this;
        _this.expression = expression;
        _this.index = index;
        _this.reason = reason;
        return _this;
    }
    return ParsingError;
}(CustomError));
export { ParsingError };
var RuntimeError = /** @class */ (function (_super) {
    __extends(RuntimeError, _super);
    function RuntimeError(ast, message, cause) {
        var _this = _super.call(this, message, { cause: cause }) || this;
        _this.ast = ast;
        return _this;
    }
    return RuntimeError;
}(CustomError));
export { RuntimeError };
var UnexpectedError = /** @class */ (function (_super) {
    __extends(UnexpectedError, _super);
    function UnexpectedError(message, cause) {
        return _super.call(this, message, { cause: cause }) || this;
    }
    return UnexpectedError;
}(CustomError));
export { UnexpectedError };
//# sourceMappingURL=CustomErrors.js.map