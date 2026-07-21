import { type CssInjectionRuleBody, NodeType } from '../../nodes-new';
import {
    CLOSE_CURLY_BRACKET,
    CSS_MEDIA_MARKER,
    CSS_NOT_PSEUDO,
    EMPTY,
    OPEN_CURLY_BRACKET,
    SPACE,
} from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { SelectorListOrRawGenerator } from '../cosmetic/selector/selector-list-or-raw-generator';

import { DeclarationListGenerator } from './declaration-list-generator';

/**
 * AdGuard CSS injection generator.
 */
export class AdgCssInjectionGenerator extends BaseGenerator {
    /**
     * CSS declaration for removing elements.
     */
    private static REMOVE_DECLARATION = 'remove: true;';

    /**
     * Serializes an AdGuard CSS injection node into a raw string.
     *
     * @param node Node to serialize.
     *
     * @returns Raw string.
     */
    public static generate(node: CssInjectionRuleBody): string {
        const result: string[] = [];

        if (node.mediaQueryList) {
            if (node.mediaQueryNegated) {
                result.push(
                    CSS_MEDIA_MARKER,
                    SPACE,
                    CSS_NOT_PSEUDO,
                    SPACE,
                    node.mediaQueryList.value,
                    SPACE,
                    OPEN_CURLY_BRACKET,
                    SPACE,
                );
            } else {
                result.push(CSS_MEDIA_MARKER, SPACE, node.mediaQueryList.value, SPACE, OPEN_CURLY_BRACKET, SPACE);
            }
        }

        result.push(SelectorListOrRawGenerator.generate(node.selectorList), SPACE, OPEN_CURLY_BRACKET, SPACE);

        if (node.remove) {
            result.push(AdgCssInjectionGenerator.REMOVE_DECLARATION);
        } else if (node.declarationList) {
            if (node.declarationList.type === NodeType.Raw) {
                result.push(node.declarationList.value);
            } else {
                result.push(DeclarationListGenerator.generate(node.declarationList));
            }
        }

        result.push(SPACE, CLOSE_CURLY_BRACKET);

        if (node.mediaQueryList) {
            result.push(SPACE, CLOSE_CURLY_BRACKET);
        }

        return result.join(EMPTY);
    }
}
