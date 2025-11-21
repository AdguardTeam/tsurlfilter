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
    // `HtmlFilteringRuleBody` node
    Selectors: 1,
    Start: 2,
    End: 3,

    // `HtmlFilteringRuleSelector` node
    Selector: 4,
    TagName: 5,
    Attributes: 6,
    PseudoClasses: 7,

    // `HtmlFilteringRuleSelectorAttribute` node
    Attribute: 8,
    AttributeName: 9,
    AttributeValue: 10,
    AttributeFlags: 11,

    // `HtmlFilteringRuleSelectorPseudoClass` node
    PseudoClass: 12,
    PseudoClassName: 13,
    PseudoClassContent: 14,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HtmlFilteringBodyMarshallingMap = typeof HtmlFilteringBodyMarshallingMap[
    keyof typeof HtmlFilteringBodyMarshallingMap
];
