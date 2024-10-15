import type { CssInjectionRuleBody } from '../../nodes';
import {
    CLOSE_CURLY_BRACKET,
    COLON,
    CSS_MEDIA_MARKER,
    EMPTY,
    OPEN_CURLY_BRACKET,
    SEMICOLON,
    SPACE,
} from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { REMOVE_PROPERTY, REMOVE_VALUE } from '../../parser/css/adg-css-injection';

export class AdgCssInjectionGenerator extends BaseGenerator {
    private static removeDeclaration = `${REMOVE_PROPERTY}${COLON}${SPACE}${REMOVE_VALUE}${SEMICOLON}`;

    /**
     * Serializes an AdGuard CSS injection node into a raw string.
     *
     * @param node Node to serialize.
     * @returns Raw string.
     */
    public static generate(node: CssInjectionRuleBody): string {
        const result: string[] = [];

        if (node.mediaQueryList) {
            result.push(CSS_MEDIA_MARKER, SPACE, node.mediaQueryList.value, SPACE, OPEN_CURLY_BRACKET, SPACE);
        }

        result.push(node.selectorList.value, SPACE, OPEN_CURLY_BRACKET, SPACE);

        if (node.remove) {
            result.push(AdgCssInjectionGenerator.removeDeclaration);
        } else if (node.declarationList?.value) {
            result.push(node.declarationList.value);
        }

        result.push(SPACE, CLOSE_CURLY_BRACKET);

        if (node.mediaQueryList) {
            result.push(SPACE, CLOSE_CURLY_BRACKET);
        }

        return result.join(EMPTY);
    }
}
