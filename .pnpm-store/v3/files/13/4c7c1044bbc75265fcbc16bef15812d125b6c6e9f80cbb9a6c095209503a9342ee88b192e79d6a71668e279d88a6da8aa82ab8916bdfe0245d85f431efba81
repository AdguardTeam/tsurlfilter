export declare const EXTENDED_CSS_VERSION: string;
export declare const BRACKET: {
    SQUARE: {
        LEFT: string;
        RIGHT: string;
    };
    PARENTHESES: {
        LEFT: string;
        RIGHT: string;
    };
    CURLY: {
        LEFT: string;
        RIGHT: string;
    };
};
export declare const SLASH = "/";
export declare const BACKSLASH = "\\";
export declare const SPACE = " ";
export declare const COMMA = ",";
export declare const DOT = ".";
export declare const SEMICOLON = ";";
export declare const COLON = ":";
export declare const SINGLE_QUOTE = "'";
export declare const DOUBLE_QUOTE = "\"";
export declare const CARET = "^";
export declare const DOLLAR_SIGN = "$";
export declare const EQUAL_SIGN = "=";
export declare const TAB = "\t";
export declare const CARRIAGE_RETURN = "\r";
export declare const LINE_FEED = "\n";
export declare const FORM_FEED = "\f";
export declare const WHITE_SPACE_CHARACTERS: string[];
export declare const ASTERISK = "*";
export declare const ID_MARKER = "#";
export declare const CLASS_MARKER = ".";
export declare const DESCENDANT_COMBINATOR = " ";
export declare const CHILD_COMBINATOR = ">";
export declare const NEXT_SIBLING_COMBINATOR = "+";
export declare const SUBSEQUENT_SIBLING_COMBINATOR = "~";
export declare const COMBINATORS: string[];
export declare const SUPPORTED_SELECTOR_MARKS: string[];
export declare const SUPPORTED_STYLE_DECLARATION_MARKS: string[];
export declare const CONTAINS_PSEUDO = "contains";
export declare const HAS_TEXT_PSEUDO = "has-text";
export declare const ABP_CONTAINS_PSEUDO = "-abp-contains";
export declare const MATCHES_CSS_PSEUDO = "matches-css";
export declare const MATCHES_CSS_BEFORE_PSEUDO = "matches-css-before";
export declare const MATCHES_CSS_AFTER_PSEUDO = "matches-css-after";
export declare const MATCHES_ATTR_PSEUDO_CLASS_MARKER = "matches-attr";
export declare const MATCHES_PROPERTY_PSEUDO_CLASS_MARKER = "matches-property";
export declare const XPATH_PSEUDO_CLASS_MARKER = "xpath";
export declare const NTH_ANCESTOR_PSEUDO_CLASS_MARKER = "nth-ancestor";
export declare const CONTAINS_PSEUDO_NAMES: string[];
/**
 * Pseudo-class :upward() can get number or selector arg
 * and if the arg is selector it should be standard, not extended
 * so :upward pseudo-class is always absolute.
 */
export declare const UPWARD_PSEUDO_CLASS_MARKER = "upward";
/**
 * Pseudo-class `:remove()` and pseudo-property `remove`
 * are used for element actions, not for element selecting.
 *
 * Selector text should not contain the pseudo-class
 * so selector parser should consider it as invalid
 * and both are handled by stylesheet parser.
 */
export declare const REMOVE_PSEUDO_MARKER = "remove";
export declare const HAS_PSEUDO_CLASS_MARKER = "has";
export declare const ABP_HAS_PSEUDO_CLASS_MARKER = "-abp-has";
export declare const HAS_PSEUDO_CLASS_MARKERS: string[];
export declare const IS_PSEUDO_CLASS_MARKER = "is";
export declare const NOT_PSEUDO_CLASS_MARKER = "not";
export declare const ABSOLUTE_PSEUDO_CLASSES: string[];
export declare const RELATIVE_PSEUDO_CLASSES: string[];
export declare const SUPPORTED_PSEUDO_CLASSES: string[];
export declare const OPTIMIZATION_PSEUDO_CLASSES: string[];
/**
 * ':scope' is used for extended pseudo-class :has(), if-not(), :is() and :not().
 */
export declare const SCOPE_CSS_PSEUDO_CLASS = ":scope";
/**
 * ':after' and ':before' are needed for :matches-css() pseudo-class
 * all other are needed for :has() limitation after regular pseudo-elements.
 *
 * @see {@link https://bugs.chromium.org/p/chromium/issues/detail?id=669058#c54} [case 3]
 */
export declare const REGULAR_PSEUDO_ELEMENTS: {
    AFTER: string;
    BACKDROP: string;
    BEFORE: string;
    CUE: string;
    CUE_REGION: string;
    FIRST_LETTER: string;
    FIRST_LINE: string;
    FILE_SELECTION_BUTTON: string;
    GRAMMAR_ERROR: string;
    MARKER: string;
    PART: string;
    PLACEHOLDER: string;
    SELECTION: string;
    SLOTTED: string;
    SPELLING_ERROR: string;
    TARGET_TEXT: string;
};
export declare const AT_RULE_MARKER = "@";
export declare const CONTENT_CSS_PROPERTY = "content";
export declare const PSEUDO_PROPERTY_POSITIVE_VALUE = "true";
export declare const DEBUG_PSEUDO_PROPERTY_GLOBAL_VALUE = "global";
export declare const NO_SELECTOR_ERROR_PREFIX = "Selector should be defined";
export declare const STYLE_ERROR_PREFIX: {
    NO_STYLE: string;
    NO_SELECTOR: string;
    INVALID_STYLE: string;
    UNCLOSED_STYLE: string;
    NO_PROPERTY: string;
    NO_VALUE: string;
    NO_STYLE_OR_REMOVE: string;
    NO_COMMENT: string;
};
export declare const NO_AT_RULE_ERROR_PREFIX = "At-rules are not supported";
export declare const REMOVE_ERROR_PREFIX: {
    INVALID_REMOVE: string;
    NO_TARGET_SELECTOR: string;
    MULTIPLE_USAGE: string;
    INVALID_POSITION: string;
};
export declare const MATCHING_ELEMENT_ERROR_PREFIX = "Error while matching element";
export declare const MAX_STYLE_PROTECTION_COUNT = 50;
