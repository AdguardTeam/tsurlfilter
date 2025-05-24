/* eslint-disable no-param-reassign */
import { type ParameterList, type ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import { NULL } from '../../../utils/constants.js';
import { ParameterListDeserializer } from '../../misc/parameter-list-deserializer.js';
import { BaseDeserializer } from '../../base-deserializer.js';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer.js';
import {
    AbpSnippetBodyMarshallingMap,
} from '../../../marshalling-utils/cosmetic/body/abp-snippet-injection-body-common.js';
import { BinaryTypeMarshallingMap } from '../../../marshalling-utils/misc/binary-type-common.js';

/**
 * Deserializes binary data into scriptlet body nodes.
 * Optionally uses a map of frequently used scriptlet arguments.
 */
export class ScriptletBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a hint rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentScriptletArgs Map of frequently used scriptlet names / arguments
     * and their serialization index (optional).
     * @throws If the binary data is malformed.
     */
    public static deserialize = (
        buffer: InputByteBuffer,
        node: Partial<ScriptletInjectionRuleBody>,
        frequentScriptletArgs?: Map<number, string>,
    ): void => {
        buffer.assertUint8(BinaryTypeMarshallingMap.ScriptletInjectionRuleBodyNode);

        node.type = 'ScriptletInjectionRuleBody';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case AbpSnippetBodyMarshallingMap.Children:
                    node.children = new Array(buffer.readUint8());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        ParameterListDeserializer.deserialize(
                            buffer,
                            node.children[i] = {} as ParameterList,
                            frequentScriptletArgs,
                        );
                    }
                    break;

                case AbpSnippetBodyMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case AbpSnippetBodyMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    };
}
