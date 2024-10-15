/* eslint-disable no-param-reassign */
import { MODIFIER_ASSIGN_OPERATOR, NEGATION_MARKER, NULL } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { BinaryTypeMap, type Modifier, type Value } from '../../nodes';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../interface';
import { ValueParser } from './value';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum ModifierNodeSerializationMap {
    Name = 1,
    Value,
    Exception,
    Start,
    End,
}

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const FREQUENT_MODIFIERS_SERIALIZATION_MAP = new Map<string, number>([
    ['_', 0],
    ['all', 1],
    ['app', 2],
    ['badfilter', 3],
    ['cname', 4],
    ['content', 5],
    ['cookie', 6],
    ['csp', 7],
    ['denyallow', 8],
    ['document', 9],
    ['doc', 10],
    ['domain', 11],
    ['from', 12],
    ['elemhide', 13],
    ['ehide', 14],
    ['empty', 15],
    ['first-party', 16],
    ['1p', 17],
    ['extension', 18],
    ['font', 19],
    ['genericblock', 20],
    ['generichide', 21],
    ['ghide', 22],
    ['header', 23],
    ['hls', 24],
    ['image', 25],
    ['important', 26],
    ['inline-font', 27],
    ['inline-script', 28],
    ['jsinject', 29],
    ['jsonprune', 30],
    ['match-case', 31],
    ['media', 32],
    ['method', 33],
    ['mp4', 34],
    ['network', 35],
    ['object-subrequest', 36],
    ['object', 37],
    ['other', 38],
    ['permissions', 39],
    ['ping', 40],
    ['popunder', 41],
    ['popup', 42],
    ['redirect-rule', 43],
    ['redirect', 44],
    ['rewrite', 45],
    ['referrerpolicy', 46],
    ['removeheader', 47],
    ['removeparam', 48],
    ['replace', 49],
    ['script', 50],
    ['specifichide', 51],
    ['shide', 52],
    ['stealth', 53],
    ['strict1p', 54],
    ['strict3p', 55],
    ['stylesheet', 56],
    ['css', 57],
    ['subdocument', 58],
    ['frame', 59],
    ['third-party', 60],
    ['3p', 61],
    ['to', 62],
    ['urlblock', 63],
    ['webrtc', 64],
    ['websocket', 65],
    ['xmlhttprequest', 66],
    ['xhr', 67],
    // TODO: add new modifiers here
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * @note Only 256 values can be represented this way.
 */
// FIXME
const FREQUENT_MODIFIERS_DESERIALIZATION_MAP = new Map<number, string>(
    Array.from(FREQUENT_MODIFIERS_SERIALIZATION_MAP, ([key, value]) => [value, key]),
);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the binary schema version
 *
 * @note Only 256 values can be represented this way.
 */
const FREQUENT_REDIRECT_VALUES_SERIALIZATION_MAP = new Map<string, number>([
    // AdGuard
    ['1x1-transparent.gif', 0],
    ['2x2-transparent.png', 1],
    ['3x2-transparent.png', 2],
    ['32x32-transparent.png', 3],
    ['amazon-apstag', 4],
    ['ati-smarttag', 5],
    ['didomi-loader', 6],
    ['click2load.html', 7],
    ['fingerprintjs2', 8],
    ['fingerprintjs3', 9],
    ['google-analytics', 10],
    ['google-analytics-ga', 11],
    ['googlesyndication-adsbygoogle', 12],
    ['googlesyndication-adsbygoogle', 13],
    ['googletagmanager-gtm', 14],
    ['googletagmanager-gtm', 15],
    ['googletagservices-gpt', 16],
    ['google-ima3', 17],
    ['gemius', 18],
    ['matomo', 19],
    ['metrika-yandex-watch', 20],
    ['metrika-yandex-tag', 21],
    ['naver-wcslog', 22],
    ['noeval', 23],
    ['noopcss', 24],
    ['noopframe', 25],
    ['noopjs', 26],
    ['noopjson', 27],
    ['nooptext', 28],
    ['noopmp3-0.1s', 29],
    ['noopmp4-1s', 30],
    ['noopvmap-1.0', 31],
    ['noopvast-2.0', 32],
    ['noopvast-3.0', 33],
    ['noopvast-4.0', 34],
    ['prebid', 35],
    ['pardot-1.0', 36],
    ['prevent-bab', 37],
    ['prevent-bab2', 38],
    ['prevent-fab-3.2.0', 39],
    ['prevent-fab-3.2.0', 40],
    ['prevent-popads-net', 41],
    ['scorecardresearch-beacon', 42],
    ['set-popads-dummy', 43],
    ['empty', 44],
    ['prebid-ads', 45],
    // empty slots for future use

    // uBlock Origin
    ['1x1.gif', 60],
    ['2x2.png', 61],
    ['3x2.png', 62],
    ['32x32.png', 63],
    ['amazon_apstag.js', 64],
    ['click2load.html', 65],
    ['fingerprint2.js', 66],
    ['fingerprint3.js', 67],
    ['google-analytics_analytics.js', 68],
    ['google-analytics_ga.js', 69],
    ['googlesyndication_adsbygoogle.js', 70],
    ['googlesyndication.com/adsbygoogle.js', 71],
    ['google-analytics_ga.js', 72],
    ['googletagmanager_gtm.js', 73],
    ['googletagservices_gpt.js', 74],
    ['google-ima.js', 75],
    ['noeval-silent.js', 76],
    ['noop.css', 77],
    ['noop.html', 78],
    ['noop.js', 79],
    ['noop.json', 80],
    ['noop.txt', 81],
    ['noop-0.1s.mp3', 82],
    ['noop-1s.mp4', 83],
    ['noop-vmap1.0.xml', 84],
    ['nobab.js', 85],
    ['nobab2.js', 86],
    ['nofab.js', 87],
    ['fuckadblock.js-3.2.0', 88],
    ['popads.js', 89],
    ['scorecardresearch_beacon.js', 90],
    ['popads-dummy.js', 91],
    ['empty', 92],
    ['prebid-ads.js', 93],
    // empty slots for future use

    // Adblock Plus
    ['1x1-transparent-gif', 105],
    ['2x2-transparent-png', 106],
    ['3x2-transparent-png', 107],
    ['32x32-transparent-png', 108],
    ['blank-css', 109],
    ['blank-html', 110],
    ['blank-js', 111],
    ['blank-text', 112],
    ['blank-mp3', 113],
    ['blank-mp4', 114],
    // empty slots for future use

    ['abp-resource:1x1-transparent-gif', 120],
    ['abp-resource:2x2-transparent-png', 121],
    ['abp-resource:3x2-transparent-png', 122],
    ['abp-resource:32x32-transparent-png', 123],
    ['abp-resource:blank-css', 124],
    ['abp-resource:blank-html', 125],
    ['abp-resource:blank-js', 126],
    ['abp-resource:blank-text', 127],
    ['abp-resource:blank-mp3', 128],
    ['abp-resource:blank-mp4', 129],

    // TODO: add other common values
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * @note This is a special map which allows us to use different value maps for different modifiers.
 */
const FREQUENT_VALUES_SERIALIZATION_MAPS = new Map<string, Map<string, number>>([
    ['redirect', FREQUENT_REDIRECT_VALUES_SERIALIZATION_MAP],
    ['redirect-rule', FREQUENT_REDIRECT_VALUES_SERIALIZATION_MAP],
    ['rewrite', FREQUENT_REDIRECT_VALUES_SERIALIZATION_MAP],

    // TODO: Add other modifiers here
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
// FIXME
const FREQUENT_VALUES_DESERIALIZATION_MAPS = new Map<string, Map<number, string>>(
    Array.from(
        FREQUENT_VALUES_SERIALIZATION_MAPS,
        ([modifier, valueMap]) => [modifier, new Map(Array.from(valueMap, ([key, value]) => [value, key]))],
    ),
);

/**
 * `ModifierParser` is responsible for parsing modifiers.
 *
 * @example
 * `match-case`, `~third-party`, `domain=example.com|~example.org`
 */
export class ModifierParser extends BaseParser {
    /**
     * Parses a modifier.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Parsed modifier
     * @throws An error if modifier name or value is empty.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): Modifier {
        let offset = 0;

        // Skip leading whitespace
        offset = StringUtils.skipWS(raw, offset);

        // Save the offset of the first character of the modifier (whole modifier)
        const modifierStart = offset;

        // Check if the modifier is an exception
        let exception = false;

        if (raw[offset] === NEGATION_MARKER) {
            offset += NEGATION_MARKER.length;
            exception = true;
        }

        // Skip whitespace after the exception marker (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Save the offset of the first character of the modifier name
        const modifierNameStart = offset;

        // Find assignment operator
        const assignmentIndex = StringUtils.findNextUnescapedCharacter(raw, MODIFIER_ASSIGN_OPERATOR);

        // Find the end of the modifier
        const modifierEnd = Math.max(StringUtils.skipWSBack(raw) + 1, modifierNameStart);

        // Modifier name can't be empty
        if (modifierNameStart === modifierEnd) {
            throw new AdblockSyntaxError(
                'Modifier name cannot be empty',
                baseOffset,
                baseOffset + raw.length,
            );
        }

        let modifier: Value;
        let value: Value | undefined;

        // If there is no assignment operator, the whole modifier is the name
        // without a value
        if (assignmentIndex === -1) {
            modifier = ValueParser.parse(
                raw.slice(modifierNameStart, modifierEnd),
                options,
                baseOffset + modifierNameStart,
            );
        } else {
            // If there is an assignment operator, first we need to find the
            // end of the modifier name, then we can parse the value
            const modifierNameEnd = StringUtils.skipWSBack(raw, assignmentIndex - 1) + 1;

            modifier = ValueParser.parse(
                raw.slice(modifierNameStart, modifierNameEnd),
                options,
                baseOffset + modifierNameStart,
            );

            // Value can't be empty
            if (assignmentIndex + 1 === modifierEnd) {
                throw new AdblockSyntaxError(
                    'Modifier value cannot be empty',
                    baseOffset,
                    baseOffset + raw.length,
                );
            }

            // Skip whitespace after the assignment operator
            const valueStart = StringUtils.skipWS(raw, assignmentIndex + MODIFIER_ASSIGN_OPERATOR.length);

            value = ValueParser.parse(
                raw.slice(valueStart, modifierEnd),
                options,
                baseOffset + valueStart,
            );
        }

        const result: Modifier = {
            type: 'Modifier',
            name: modifier,
            value,
            exception,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset + modifierStart;
            result.end = baseOffset + modifierEnd;
        }

        return result;
    }

    /**
     * Deserializes a modifier node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Modifier>): void {
        buffer.assertUint8(BinaryTypeMap.ModifierNode);

        node.type = 'Modifier';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ModifierNodeSerializationMap.Name:
                    ValueParser.deserialize(buffer, node.name = {} as Value, FREQUENT_MODIFIERS_DESERIALIZATION_MAP);
                    break;

                case ModifierNodeSerializationMap.Value:
                    if (node.name) {
                        // eslint-disable-next-line max-len
                        ValueParser.deserialize(buffer, node.value = {} as Value, FREQUENT_VALUES_DESERIALIZATION_MAPS.get(node.name.value));
                    } else {
                        ValueParser.deserialize(buffer, node.value = {} as Value);
                    }
                    break;

                case ModifierNodeSerializationMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case ModifierNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ModifierNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
