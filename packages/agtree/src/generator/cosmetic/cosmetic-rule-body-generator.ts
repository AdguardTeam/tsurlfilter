import { BaseGenerator } from '../base-generator.js';
import { type AnyCosmeticRule, CosmeticRuleType } from '../../nodes/index.js';
import {
    CLOSE_PARENTHESIS,
    COLON,
    EMPTY,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../utils/constants.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { AdgScriptletInjectionBodyGenerator } from './body/adg-scriptlet-injection-body-generator.js';
import { AdgCssInjectionGenerator } from '../css/adg-css-injection-generator.js';
import { AbpSnippetInjectionBodyGenerator } from './body/abp-snippet-injection-body-generator.js';
import { UboScriptletInjectionBodyGenerator } from './body/ubo-scriptlet-injection-body-generator.js';
import { UboPseudoName } from '../../common/ubo-selector-common.js';

/**
 * Cosmetic rule body generator.
 */
export class CosmeticRuleBodyGenerator extends BaseGenerator {
    /**
     * Generates the rule body from the node.
     *
     * @param node Cosmetic rule node
     * @returns Raw rule body
     * @example
     * - '##.foo' → '.foo'
     * - 'example.com,example.org##.foo' → '.foo'
     * - 'example.com#%#//scriptlet('foo')' → '//scriptlet('foo')'
     *
     * @throws Error if the rule type is unknown
     */
    public static generate(node: AnyCosmeticRule): string {
        let result = EMPTY;

        switch (node.type) {
            case CosmeticRuleType.ElementHidingRule:
                result = node.body.selectorList.value;
                break;

            case CosmeticRuleType.CssInjectionRule:
                if (node.syntax === AdblockSyntax.Adg || node.syntax === AdblockSyntax.Abp) {
                    result = AdgCssInjectionGenerator.generate(node.body);
                } else if (node.syntax === AdblockSyntax.Ubo) {
                    if (node.body.mediaQueryList) {
                        result += COLON;
                        result += UboPseudoName.MatchesMedia;
                        result += OPEN_PARENTHESIS;
                        result += node.body.mediaQueryList.value;
                        result += CLOSE_PARENTHESIS;
                        result += SPACE;
                    }

                    result += node.body.selectorList.value;

                    if (node.body.remove) {
                        result += COLON;
                        result += UboPseudoName.Remove;
                        result += OPEN_PARENTHESIS;
                        result += CLOSE_PARENTHESIS;
                    } else if (node.body.declarationList) {
                        result += COLON;
                        result += UboPseudoName.Style;
                        result += OPEN_PARENTHESIS;
                        result += node.body.declarationList.value;
                        result += CLOSE_PARENTHESIS;
                    }
                }
                break;

            case CosmeticRuleType.HtmlFilteringRule:
            case CosmeticRuleType.JsInjectionRule:
                result = node.body.value;
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                switch (node.syntax) {
                    case AdblockSyntax.Adg:
                        result = AdgScriptletInjectionBodyGenerator.generate(node.body);
                        break;

                    case AdblockSyntax.Abp:
                        result = AbpSnippetInjectionBodyGenerator.generate(node.body);
                        break;

                    case AdblockSyntax.Ubo:
                        result = UboScriptletInjectionBodyGenerator.generate(node.body);
                        break;

                    default:
                        throw new Error('Scriptlet rule should have an explicit syntax');
                }
                break;

            default:
                throw new Error('Unknown cosmetic rule type');
        }

        return result;
    }
}
