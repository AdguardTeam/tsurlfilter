/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import { type AppList, ListNodeType } from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ListItemsDeserializer } from './list-items-deserializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { AppListMarshallingMap } from '../../marshalling-utils/misc/app-list-common';

/**
 * `AppListDeserializer` is responsible for deserializing an app list.
 */
export class AppListDeserializer extends BaseDeserializer {
    /**
     * Deserializes an app list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: AppList): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.AppListNode);

        node.type = ListNodeType.AppList;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case AppListMarshallingMap.Children:
                    ListItemsDeserializer.deserialize(buffer, node.children = []);
                    break;

                case AppListMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case AppListMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
