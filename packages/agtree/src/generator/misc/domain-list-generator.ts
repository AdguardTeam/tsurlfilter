import type { DomainList } from '../../nodes/index.js';
import { BaseGenerator } from '../base-generator.js';
import { ListItemsGenerator } from './list-items-generator.js';

/**
 * Domain list generator.
 */
export class DomainListGenerator extends BaseGenerator {
    /**
     * Converts a domain list node to a string.
     *
     * @param node Domain list node.
     *
     * @returns Raw string.
     */
    public static generate(node: DomainList): string {
        return ListItemsGenerator.generate(node.children, node.separator);
    }
}
