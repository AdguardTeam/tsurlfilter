import type { DomainList } from '../../nodes';
import { generateListItems } from '../../parser/misc/list-helpers';
import { BaseGenerator } from '../base-generator';

export class DomainListGenerator extends BaseGenerator {
    /**
     * Converts a domain list node to a string.
     *
     * @param node Domain list node.
     *
     * @returns Raw string.
     */
    public static generate(node: DomainList): string {
        return generateListItems(node.children, node.separator);
    }
}
