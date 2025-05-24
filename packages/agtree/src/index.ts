/**
 * @file AGTree entry point
 */

// Parser
export { RuleParser } from './parser/rule-parser.js';
export { RuleSerializer } from './serializer/rule-serializer.js';
export { RuleDeserializer } from './deserializer/rule-deserializer.js';
export { RuleGenerator } from './generator/rule-generator.js';

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
} from './nodes/index.js';
export { AdblockSyntaxError } from './errors/adblock-syntax-error.js';
export { AgentCommentParser } from './parser/comment/agent-comment-parser.js';
export { AgentParser } from './parser/comment/agent-parser.js';
export { CommentParser } from './parser/comment/comment-parser.js';
export { ConfigCommentParser } from './parser/comment/config-comment-parser.js';
export { CosmeticRuleParser } from './parser/cosmetic/cosmetic-rule-parser.js';
export { AppListParser } from './parser/misc/app-list-parser.js';
export { DomainListParser } from './parser/misc/domain-list-parser.js';
export { MethodListParser } from './parser/misc/method-list-parser.js';
export { StealthOptionListParser } from './parser/misc/stealth-option-list-parser.js';
export { FilterListParser } from './parser/filterlist-parser.js';
export { FilterListSerializer } from './serializer/filterlist-serializer.js';
export { FilterListDeserializer } from './deserializer/filterlist-deserializer.js';
export { HintCommentParser } from './parser/comment/hint-comment-parser.js';
export { HintParser } from './parser/comment/hint-parser.js';
export { LogicalExpressionParser } from './parser/misc/logical-expression-parser.js';
export { MetadataCommentParser } from './parser/comment/metadata-comment-parser.js';
export { ModifierListParser } from './parser/misc/modifier-list.js';
export { ModifierParser } from './parser/misc/modifier-parser.js';
export { NetworkRuleParser } from './parser/network/network-rule-parser.js';
export { NotImplementedError } from './errors/not-implemented-error.js';
export { ParameterListParser } from './parser/misc/parameter-list-parser.js';
export { HostRuleParser } from './parser/network/host-rule-parser.js';
export { PreProcessorCommentParser } from './parser/comment/preprocessor-parser.js';
export { RuleConversionError } from './errors/rule-conversion-error.js';
export { BinarySchemaMismatchError } from './errors/binary-schema-mismatch-error.js';

// Validator
export { modifierValidator } from './validator/index.js';

// Export converter's entry point
export * from './converter/index.js';

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
} from './utils/constants.js';
export { BINARY_SCHEMA_VERSION } from './utils/binary-schema-version.js';
export { AdblockSyntax } from './utils/adblockers.js';
export { type CosmeticRuleSeparatorFinderResult, CosmeticRuleSeparatorUtils } from './utils/cosmetic-rule-separator.js';
export { DomainUtils } from './utils/domain.js';
export { type VariableTable, LogicalExpressionUtils } from './utils/logical-expression.js';
export {
    ADBLOCK_URL_START,
    ADBLOCK_URL_START_REGEX,
    ADBLOCK_URL_SEPARATOR,
    ADBLOCK_URL_SEPARATOR_REGEX,
    ADBLOCK_WILDCARD,
    ADBLOCK_WILDCARD_REGEX,
    SPECIAL_REGEX_SYMBOLS,
    RegExpUtils,
} from './utils/regexp.js';
export {
    QuoteType,
    QuoteUtils,
} from './utils/quotes.js';
export { type Position, PositionProvider } from './utils/position-provider.js';
export { OutputByteBuffer } from './utils/output-byte-buffer.js';
export { InputByteBuffer } from './utils/input-byte-buffer.js';
export { ByteBuffer } from './utils/byte-buffer.js';
export { encodeIntoPolyfill, type TextEncoderPolyfillResult } from './utils/text-encoder-polyfill.js';
export { decodeTextPolyfill } from './utils/text-decoder-polyfill.js';
export { RuleCategorizer } from './utils/categorizer.js';

// Constants
export { EXT_CSS_PSEUDO_CLASSES, EXT_CSS_LEGACY_ATTRIBUTES, FORBIDDEN_CSS_FUNCTIONS } from './converter/data/css.js';

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
} from './compatibility-tables/index.js';

// Version
export { AGTREE_VERSION } from './version.js';
export { getSyntaxSerializationMap } from './marshalling-utils/syntax-serialization-map.js';
