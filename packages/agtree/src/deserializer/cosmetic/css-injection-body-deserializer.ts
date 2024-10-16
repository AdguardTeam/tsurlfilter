/* eslint-disable no-param-reassign */
import { BinaryTypeMap, type Value, type CssInjectionRuleBody } from '../../nodes';
import { ValueDeserializer } from '../misc/value-deserializer';
import { NULL } from '../../utils/constants';
import { BaseDeserializer } from '../base-deserializer';
import { CssInjectionRuleSerializationMap } from '../../serialization-utils/cosmetic/body/css-injection-body-common';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';

export class CssInjectionBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes CSS injection rule body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: CssInjectionRuleBody): void {
        buffer.assertUint8(BinaryTypeMap.CssInjectionRuleBody);

        node.type = 'CssInjectionRuleBody';
        node.remove = false;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssInjectionRuleSerializationMap.MediaQueryList:
                    ValueDeserializer.deserialize(buffer, node.mediaQueryList = {} as Value);
                    break;

                case CssInjectionRuleSerializationMap.SelectorList:
                    ValueDeserializer.deserialize(buffer, node.selectorList = {} as Value);
                    break;

                case CssInjectionRuleSerializationMap.DeclarationList:
                    ValueDeserializer.deserialize(buffer, node.declarationList = {} as Value);
                    break;

                case CssInjectionRuleSerializationMap.Remove:
                    node.remove = true;
                    break;

                case CssInjectionRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CssInjectionRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
