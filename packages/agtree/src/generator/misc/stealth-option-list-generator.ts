import type { StealthOptionList } from '../../nodes';
import { BaseGenerator } from '../base-generator';
import { ListItemsGenerator } from './list-items-generator';

/**
 * Stealth option list generator.
 */
export class StealthOptionListGenerator extends BaseGenerator {
    /**
     * Converts a stealth option list node to a string.
     *
     * @param node Stealth option list node.
     *
     * @returns Raw string.
     */
    public static generate(node: StealthOptionList): string {
        return ListItemsGenerator.generate(node.children, node.separator);
    }
}
