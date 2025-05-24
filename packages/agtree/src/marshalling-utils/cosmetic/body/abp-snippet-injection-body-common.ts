import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version.js';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const AbpSnippetBodyMarshallingMap = {
    Children: 1,
    Start: 2,
    End: 3,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type AbpSnippetBodyMarshallingMap = typeof AbpSnippetBodyMarshallingMap[
    keyof typeof AbpSnippetBodyMarshallingMap
];

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
// TODO: Update this map with the actual values
export const FREQUENT_ABP_SNIPPET_ARGS_SERIALIZATION_MAP = new Map<string, number>([
    ['abort-current-inline-script', 0],
    ['abort-on-property-read', 1],
    ['abort-on-property-write', 2],
    ['json-prune', 3],
    ['log', 4],
    ['prevent-listener', 5],
    ['cookie-remover', 6],
    ['override-property-read', 7],
    ['abort-on-iframe-property-read', 8],
    ['abort-on-iframe-property-write', 9],
    ['freeze-element', 10],
    ['json-override', 11],
    ['simulate-mouse-event', 12],
    ['strip-fetch-query-parameter', 13],
    ['hide-if-contains', 14],
    ['hide-if-contains-image', 15],
    ['hide-if-contains-image-hash', 16],
    ['hide-if-contains-similar-text', 17],
    ['hide-if-contains-visible-text', 18],
    ['hide-if-contains-and-matches-style', 19],
    ['hide-if-graph-matches', 20],
    ['hide-if-has-and-matches-style', 21],
    ['hide-if-labelled-by', 22],
    ['hide-if-matches-xpath', 23],
    ['hide-if-matches-computed-xpath', 24],
    ['hide-if-shadow-contains', 25],
    ['debug', 26],
    ['trace', 27],
    ['race', 28],
]);
