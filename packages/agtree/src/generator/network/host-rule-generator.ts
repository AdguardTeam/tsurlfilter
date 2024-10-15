import type { HostRule } from '../../nodes';
import { EMPTY, HASHMARK, SPACE } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';

export class HostRuleGenerator extends BaseGenerator {
    /**
     * Converts a host rule node to a raw string.
     *
     * @param node Host rule node.
     * @returns Raw string.
     */
    public static generate(node: HostRule): string {
        const result: string[] = [];

        if (node.ip) {
            result.push(node.ip.value);
        }

        if (node.hostnames) {
            result.push(SPACE);
            result.push(node.hostnames.children.map(({ value }) => value).join(SPACE));
        }

        if (node.comment) {
            result.push(SPACE);
            result.push(HASHMARK);
            result.push(SPACE);
            result.push(node.comment.value);
        }

        return result.join(EMPTY);
    }
}
