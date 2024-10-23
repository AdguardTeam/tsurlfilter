import { OperatorValue } from '../../nodes';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION} !
 */
export const enum VariableNodeBinaryPropMarshallingMap {
    Name = 1,
    FrequentName,
    Start,
    End,
}

/**
 * Property map for binary serialization.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION} !
 */
export const enum OperatorNodeBinaryPropMarshallingMap {
    Operator = 1,
    Left,
    Right,
    Start,
    End,
}

/**
 * Property map for binary serialization.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION} !
 */
export const enum ParenthesisNodeBinaryPropMarshallingMap {
    Expression = 1,
    Start,
    End,
}

/**
 * Property map for binary serialization.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION} !
 */
export const LOGICAL_EXPRESSION_OPERATOR_SERIALISATION_MAP = new Map<OperatorValue, number>([
    [OperatorValue.Not, 0],
    [OperatorValue.And, 1],
    [OperatorValue.Or, 2],
]);

/**
 * Serialization map for known variables.
 */
export const KNOWN_VARIABLES_SERIALIZATION_MAP = new Map<string, number>([
    ['ext_abp', 0],
    ['ext_ublock', 1],
    ['ext_ubol', 2],
    ['ext_devbuild', 3],
    ['env_chromium', 4],
    ['env_edge', 5],
    ['env_firefox', 6],
    ['env_mobile', 7],
    ['env_safari', 8],
    ['env_mv3', 9],
    ['false', 10],
    ['cap_html_filtering', 11],
    ['cap_user_stylesheet', 12],
    ['adguard', 13],
    ['adguard_app_windows', 14],
    ['adguard_app_mac', 15],
    ['adguard_app_android', 16],
    ['adguard_app_ios', 17],
    ['adguard_ext_safari', 18],
    ['adguard_ext_chromium', 19],
    ['adguard_ext_firefox', 20],
    ['adguard_ext_edge', 21],
    ['adguard_ext_opera', 22],
    ['adguard_ext_android_cb', 23],
    // TODO: Add 'adguard_ext_chromium_mv3' to the list
]);
