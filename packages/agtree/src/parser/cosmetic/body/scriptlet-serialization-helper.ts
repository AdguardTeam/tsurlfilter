/* eslint-disable no-param-reassign */
/**
 * @file Helpers for serializing scriptlet injection body nodes to binary format.
 * We keep the core logic here, because it can be reused for each scriptlet body parser.
 */

import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BinaryTypeMap, type ParameterList, type ScriptletInjectionRuleBody } from '../../../nodes';
import { ParameterListParser } from '../../misc/parameter-list';
import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const enum AbpSnippetBodySerializationMap {
    Children = 1,
    Start,
    End,
}

/**
 * Deserializes a hint rule node from binary format.
 *
 * @param buffer ByteBuffer for reading binary data.
 * @param node Destination node.
 * @param frequentScriptletArgs Map of frequently used scriptlet names / arguments
 * and their serialization index (optional).
 * @throws If the binary data is malformed.
 */
export const deserializeScriptletBody = (
    buffer: InputByteBuffer,
    node: Partial<ScriptletInjectionRuleBody>,
    frequentScriptletArgs?: Map<number, string>,
): void => {
    buffer.assertUint8(BinaryTypeMap.ScriptletInjectionRuleBodyNode);

    node.type = 'ScriptletInjectionRuleBody';

    let prop = buffer.readUint8();
    while (prop !== NULL) {
        switch (prop) {
            case AbpSnippetBodySerializationMap.Children:
                node.children = new Array(buffer.readUint8());

                // read children
                for (let i = 0; i < node.children.length; i += 1) {
                    // eslint-disable-next-line max-len
                    ParameterListParser.deserialize(buffer, node.children[i] = {} as ParameterList, frequentScriptletArgs);
                }
                break;

            case AbpSnippetBodySerializationMap.Start:
                node.start = buffer.readUint32();
                break;

            case AbpSnippetBodySerializationMap.End:
                node.end = buffer.readUint32();
                break;

            default:
                throw new Error(`Invalid property: ${prop}`);
        }

        prop = buffer.readUint8();
    }
};
