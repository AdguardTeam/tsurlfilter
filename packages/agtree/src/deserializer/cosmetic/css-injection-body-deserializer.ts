/* eslint-disable no-param-reassign */
import { type Value, type CssInjectionRuleBody } from '../../nodes/index.js';
import { ValueDeserializer } from '../misc/value-deserializer.js';
import { NULL } from '../../utils/constants.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { CssInjectionRuleMarshallingMap } from '../../marshalling-utils/cosmetic/body/css-injection-body-common.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * Deserializes CSS injection rule body nodes from binary format.
 */
export class CssInjectionBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes CSS injection rule body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: CssInjectionRuleBody): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.CssInjectionRuleBody);

        node.type = 'CssInjectionRuleBody';
        node.remove = false;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssInjectionRuleMarshallingMap.MediaQueryList:
                    ValueDeserializer.deserialize(buffer, node.mediaQueryList = {} as Value);
                    break;

                case CssInjectionRuleMarshallingMap.SelectorList:
                    ValueDeserializer.deserialize(buffer, node.selectorList = {} as Value);
                    break;

                case CssInjectionRuleMarshallingMap.DeclarationList:
                    ValueDeserializer.deserialize(buffer, node.declarationList = {} as Value);
                    break;

                case CssInjectionRuleMarshallingMap.Remove:
                    node.remove = true;
                    break;

                case CssInjectionRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CssInjectionRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
