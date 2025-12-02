import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const HtmlFilteringBodyMarshallingMap = {
    // Common
    Start: 1,
    End: 2,

    // `HtmlFilteringRuleBody` node
    SelectorList: 3,

    // `HtmlFilteringRuleSelectorList` node
    SelectorListItem: 4,
    Selectors: 5,

    // `HtmlFilteringRuleSelector` node
    SelectorsItem: 6,
    Parts: 7,
    Combinator: 8,

    // `HtmlFilteringRuleSelectorPart` nodes
    Value: 9,
    Attribute: 10,
    PseudoClass: 11,

    // `HtmlFilteringRuleSelectorAttribute` node
    AttributeName: 12,
    AttributeOperator: 13,
    AttributeValue: 14,
    AttributeFlag: 15,

    // `HtmlFilteringRuleSelectorPseudoClass` node
    PseudoClassName: 16,
    PseudoClassIsFunction: 17,
    PseudoClassArgument: 18,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HtmlFilteringBodyMarshallingMap = typeof HtmlFilteringBodyMarshallingMap[
    keyof typeof HtmlFilteringBodyMarshallingMap
];
