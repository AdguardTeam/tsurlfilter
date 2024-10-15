/**
 * @file AGTree entry point
 */

// Parser
export { RuleParser } from './parser/rule-parser';
export {
    type Agent,
    type AgentCommentRule,
    type AnyCommentRule,
    type AnyCosmeticRule,
    type AnyExpressionNode,
    type AnyRule,
    type CommentBase,
    CommentMarker,
    type CommentRule,
    CommentRuleType,
    type ConfigCommentRule,
    type CosmeticRule,
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type CssInjectionRule,
    type CssInjectionRuleBody,
    type Domain,
    type DomainList,
    type DomainListSeparator,
    type ElementHidingRule,
    type ElementHidingRuleBody,
    type EmptyRule,
    type ExpressionOperatorNode,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    type FilterList,
    type Hint,
    type HintCommentRule,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBody,
    type JsInjectionRule,
    type Location,
    type LocationRange,
    type MetadataCommentRule,
    type Modifier,
    type ModifierList,
    type NetworkRule,
    type Node,
    type ParameterList,
    type PreProcessorCommentRule,
    type RuleBase,
    RuleCategory,
    type ScriptletInjectionRule,
    type ScriptletInjectionRuleBody,
    type Value,
    NetworkRuleType,
    type HostnameList,
    type HostRule,
    type AnyNetworkRule,
} from './nodes';
export { AdblockSyntaxError } from './errors/adblock-syntax-error';
export { AgentCommentParser } from './parser/comment/agent-rule';
export { AgentParser } from './parser/comment/agent';
export { CommentRuleParser } from './parser/comment';
export { ConfigCommentParser } from './parser/comment/inline-config';
export { CosmeticRuleParser } from './parser/cosmetic';
export { AppListParser } from './parser/misc/app-list';
export { DomainListParser } from './parser/misc/domain-list';
export { MethodListParser } from './parser/misc/method-list';
export { StealthOptionListParser } from './parser/misc/stealth-option-list';
export { FilterListParser } from './parser/filterlist';
export { HintCommentParser } from './parser/comment/hint-rule';
export { HintParser } from './parser/comment/hint';
export { LogicalExpressionParser } from './parser/misc/logical-expression';
export { MetadataCommentRuleParser, getKnownMetadataHeaders } from './parser/comment/metadata';
export { ModifierListParser } from './parser/misc/modifier-list';
export { ModifierParser } from './parser/misc/modifier';
export { NetworkRuleParser } from './parser/network';
export { NotImplementedError } from './errors/not-implemented-error';
export { ParameterListParser } from './parser/misc/parameter-list';
export { HostRuleParser } from './parser/network/host';
export { PreProcessorCommentParser } from './parser/comment/preprocessor';
export { RuleConversionError } from './errors/rule-conversion-error';
export { BinarySchemaMismatchError } from './errors/binary-schema-mismatch-error';

// Validator
export { modifierValidator } from './validator';

// Export converter's entry point
export * from './converter';

// Utils
export {
    ADG_SCRIPTLET_MASK,
    AGLINT_COMMAND_PREFIX,
    COMMA_DOMAIN_LIST_SEPARATOR,
    NEGATION_MARKER,
    HINT_MARKER,
    IF,
    INCLUDE,
    MODIFIERS_SEPARATOR,
    MODIFIER_ASSIGN_OPERATOR,
    PIPE_MODIFIER_SEPARATOR,
    NETWORK_RULE_EXCEPTION_MARKER,
    NETWORK_RULE_SEPARATOR,
    PREPROCESSOR_MARKER,
    SAFARI_CB_AFFINITY,
    UBO_SCRIPTLET_MASK,
} from './utils/constants';
export { BINARY_SCHEMA_VERSION } from './utils/binary-schema-version';
export { AdblockSyntax } from './utils/adblockers';
export { type CosmeticRuleSeparatorFinderResult, CosmeticRuleSeparatorUtils } from './utils/cosmetic-rule-separator';
export { DomainUtils } from './utils/domain';
export { type VariableTable, LogicalExpressionUtils } from './utils/logical-expression';
export {
    ADBLOCK_URL_START,
    ADBLOCK_URL_START_REGEX,
    ADBLOCK_URL_SEPARATOR,
    ADBLOCK_URL_SEPARATOR_REGEX,
    ADBLOCK_WILDCARD,
    ADBLOCK_WILDCARD_REGEX,
    SPECIAL_REGEX_SYMBOLS,
    RegExpUtils,
} from './utils/regexp';
export {
    QuoteType,
    QuoteUtils,
} from './utils/quotes';
export { type Position, PositionProvider } from './utils/position-provider';
export { OutputByteBuffer } from './utils/output-byte-buffer';
export { InputByteBuffer } from './utils/input-byte-buffer';
export { ByteBuffer } from './utils/byte-buffer';
export { encodeIntoPolyfill, type TextEncoderPolyfillResult } from './utils/text-encoder-polyfill';
export { decodeTextPolyfill } from './utils/text-decoder-polyfill';
export { RuleCategorizer } from './utils/categorizer';

// Constants
export { EXT_CSS_PSEUDO_CLASSES, EXT_CSS_LEGACY_ATTRIBUTES, FORBIDDEN_CSS_FUNCTIONS } from './converter/data/css';

export {
    GenericPlatform,
    SpecificPlatform,
    modifiersCompatibilityTable,
    redirectsCompatibilityTable,
    scriptletsCompatibilityTable,
    parseRawPlatforms,
    type CompatibilityTable,
    type CompatibilityTableRow,
    type ProductRecords,
    type RowByProduct,
    type RowsByProduct,
    isGenericPlatform,
    getPlatformId,
    getSpecificPlatformName,
    ResourceType,
    getResourceTypeModifier,
    isValidResourceType,
} from './compatibility-tables';

export { defaultParserOptions, type ParserOptions } from './parser/options';

// Version
export { AGTREE_VERSION } from './version';
