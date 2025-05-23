import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version';

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
// TODO: Update this map with the actual values
export const FREQUENT_ADG_SCRIPTLET_ARGS_SERIALIZATION_MAP = new Map<string, number>([
    ['abort-current-inline-script', 0],
    ['abort-on-property-read', 1],
    ['abort-on-property-write', 2],
    ['abort-on-stack-trace', 3],
    ['adjust-setInterval', 4],
    ['adjust-setTimeout', 5],
    ['close-window', 6],
    ['debug-current-inline-script', 7],
    ['debug-on-property-read', 8],
    ['debug-on-property-write', 9],
    ['dir-string', 10],
    ['disable-newtab-links', 11],
    ['evaldata-prune', 12],
    ['json-prune', 13],
    ['log', 14],
    ['log-addEventListener', 15],
    ['log-eval', 16],
    ['log-on-stack-trace', 17],
    ['m3u-prune', 18],
    ['noeval', 19],
    ['nowebrtc', 20],
    ['no-topics', 21],
    ['prevent-addEventListener', 22],
    ['prevent-adfly', 23],
    ['prevent-bab', 24],
    ['prevent-eval-if', 25],
    ['prevent-fab-3.2.0', 26],
    ['prevent-fetch', 27],
    ['prevent-xhr', 28],
    ['prevent-popads-net', 29],
    ['prevent-refresh', 30],
    ['prevent-requestAnimationFrame', 31],
    ['prevent-setInterval', 32],
    ['prevent-setTimeout', 33],
    ['prevent-window-open', 34],
    ['remove-attr', 35],
    ['remove-class', 36],
    ['remove-cookie', 37],
    ['remove-node-text', 38],
    ['set-attr', 39],
    ['set-constant', 40],
    ['set-cookie', 41],
    ['set-cookie-reload', 42],
    ['set-local-storage-item', 43],
    ['set-popads-dummy', 44],
    ['set-session-storage-item', 45],
    ['xml-prune', 46],
]);
