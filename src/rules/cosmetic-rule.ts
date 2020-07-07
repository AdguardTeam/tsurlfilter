import * as rule from './rule';
import { CosmeticRuleMarker, findCosmeticRuleMarker, isExtCssMarker } from './cosmetic-rule-marker';
import { DomainModifier } from '../modifiers/domain-modifier';
import * as utils from '../utils/utils';

/**
 * CosmeticRuleType is an enumeration of the possible
 * cosmetic rule types.
 * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#cosmetic-rules
 */
export enum CosmeticRuleType {
    /**
     * Cosmetic rules that just hide page elements.
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#element-hiding-rules
     */
    ElementHiding,

    /**
     * Cosmetic rules that allow adding custom CSS styles.
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#cosmetic-css-rules
     */
    Css,

    /**
     * Cosmetic rules that allow executing custom JS scripts.
     * Some restrictions are applied to this type of rules by default.
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#javascript-rules
     */
    Js,

    /**
     * Special type of rules that allows filtering HTML code of web pages.
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#html-filtering-rules
     */
    Html,
}

/**
 * Implements a basic cosmetic rule.
 *
 * Cosmetic rules syntax are almost similar and looks like this:
 * ```
 * rule = [domains] "marker" content
 * domains = [domain0, domain1[, ...[, domainN]]]
 * ```
 *
 * The rule type is defined by the `marker` value, you can find the list of them
 * in the {@see CosmeticRuleMarker} enumeration.
 *
 * What matters, though, is what's in the `content` part of it.
 *
 * Examples:
 * * `example.org##.banner` -- element hiding rule
 * * `example.org#$#.banner { display: block; }` -- CSS rule
 * * `example.org#%#window.x=1;` -- JS rule
 * * `example.org#%#//scriptlet('scriptlet-name')` -- Scriptlet rule
 * * `example.org$$div[id="test"]` -- HTML filtering rule
 */
export class CosmeticRule implements rule.IRule {
    private readonly ruleText: string;

    private readonly filterListId: number;

    private readonly type: CosmeticRuleType;

    private readonly content: string;

    private whitelist = false;

    private extendedCss = false;

    private permittedDomains: string[] | null = null;

    private restrictedDomains: string[] | null = null;

    /**
     * Js script to execute
     */
    public script: string | null = null;

    /**
     * The problem with pseudo-classes is that any unknown pseudo-class makes browser ignore the whole CSS rule,
     * which contains a lot more selectors. So, if CSS selector contains a pseudo-class, we should try to validate it.
     * <p>
     * One more problem with pseudo-classes is that they are actively used in uBlock, hence it may mess AG styles.
     */
    private static readonly SUPPORTED_PSEUDO_CLASSES = [':active',
        ':checked', ':contains', ':disabled', ':empty', ':enabled', ':first-child', ':first-of-type',
        ':focus', ':has', ':has-text', ':hover', ':if', ':if-not', ':in-range', ':invalid', ':lang',
        ':last-child', ':last-of-type', ':link', ':matches-css', ':matches-css-before', ':matches-css-after',
        ':not', ':nth-child', ':nth-last-child', ':nth-last-of-type', ':nth-of-type',
        ':only-child', ':only-of-type', ':optional', ':out-of-range', ':read-only',
        ':read-write', ':required', ':root', ':target', ':valid', ':visited',
        ':-abp-has', ':-abp-contains'];

    /**
     * Pseudo class indicators. They are used to detect if rule is extended or not even if rule does not
     * have extended css marker
     */
    private readonly EXT_CSS_PSEUDO_INDICATORS = ['[-ext-has=', '[-ext-contains=', '[-ext-has-text=',
        '[-ext-matches-css=', '[-ext-matches-css-before=', '[-ext-matches-css-after=', ':has(', ':has-text(',
        ':contains(', ':matches-css(', ':matches-css-before(', ':matches-css-after(', ':-abp-has(', ':-abp-contains(',
        ':if(', ':if-not('];

    /**
     * Parses first pseudo class from the specified CSS selector
     *
     * @param selector
     * @returns pseudo class name if found or null
     */
    static parsePseudoClass(selector: string): string | null {
        let beginIndex = 0;
        let nameStartIndex = -1;
        let squareBracketIndex = 0;

        while (squareBracketIndex >= 0) {
            nameStartIndex = selector.indexOf(':', beginIndex);
            if (nameStartIndex < 0) {
                return null;
            }

            if (nameStartIndex > 0 && selector.charAt(nameStartIndex - 1) === '\\') {
                // Escaped colon character
                return null;
            }

            squareBracketIndex = selector.indexOf('[', beginIndex);
            while (squareBracketIndex >= 0) {
                if (nameStartIndex > squareBracketIndex) {
                    const squareEndBracketIndex = selector.indexOf(']', squareBracketIndex + 1);
                    beginIndex = squareEndBracketIndex + 1;
                    if (nameStartIndex < squareEndBracketIndex) {
                        // Means that colon character is somewhere inside attribute selector
                        // Something like a[src^="http://domain.com"]
                        break;
                    }

                    if (squareEndBracketIndex > 0) {
                        squareBracketIndex = selector.indexOf('[', beginIndex);
                    } else {
                        // bad rule, example: a[src="http:
                        return null;
                    }
                } else {
                    squareBracketIndex = -1;
                    break;
                }
            }
        }

        let nameEndIndex = utils.indexOfAny(
            selector,
            [' ', '\t', '>', '(', '[', '.', '#', ':', '+', '~', '"', '\''],
            nameStartIndex + 1,
        );

        if (nameEndIndex < 0) {
            nameEndIndex = selector.length;
        }

        const name = selector.substring(nameStartIndex, nameEndIndex);
        if (name.length <= 1) {
            // Either empty name or a pseudo element (like ::content)
            return null;
        }

        return name;
    }

    getText(): string {
        return this.ruleText;
    }

    getFilterListId(): number {
        return this.filterListId;
    }

    /**
     * Cosmetic rule type (always present)
     */
    getType(): CosmeticRuleType {
        return this.type;
    }

    /**
     * Whitelist means that this rule is meant to disable other rules.
     * For instance, https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#elemhide-exceptions
     */
    isWhitelist(): boolean {
        return this.whitelist;
    }

    /**
     * Gets the rule content. The meaning of this field depends on the rule type.
     * For instance, for an element hiding rule, this is just a CSS selector.
     * While, for a CSS rule, this is a CSS selector + style.
     */
    getContent(): string {
        return this.content;
    }

    /**
     * Gets list of permitted domains.
     */
    getPermittedDomains(): string[] | null {
        return this.permittedDomains;
    }

    /**
     * Returns true if the rule is considered "generic"
     * "generic" means that the rule is not restricted to a limited set of domains
     * Please note that it might be forbidden on some domains, though.
     *
     * @return {boolean}
     */
    isGeneric(): boolean {
        return !this.permittedDomains || this.permittedDomains.length === 0;
    }

    /**
     * Gets list of restricted domains.
     */
    getRestrictedDomains(): string[] | null {
        return this.restrictedDomains;
    }

    isExtendedCss(): boolean {
        return this.extendedCss;
    }

    /**
     * Creates an instance of the {@link CosmeticRule}.
     * It parses the rule and extracts the permitted/restricted domains,
     * and also the cosmetic rule's content.
     *
     * Depending on the rule type, the content might be transformed in
     * one of the helper classes, or kept as string when it's appropriate.
     *
     * @param ruleText - original rule text.
     * @param filterListId - ID of the filter list this rule belongs to.
     *
     * @throws error if it fails to parse the rule.
     */
    constructor(ruleText: string, filterListId: number) {
        this.ruleText = ruleText;
        this.filterListId = filterListId;

        const [index, marker] = findCosmeticRuleMarker(ruleText);

        if (index < 0 || marker === null) {
            throw new SyntaxError('This is not a cosmetic rule');
        }

        if (index > 0) {
            // This means that the marker is preceded by the list of domains
            // Now it's a good time to parse them.
            const domains = ruleText.substring(0, index);
            const domainModifier = new DomainModifier(domains, ',');
            this.permittedDomains = domainModifier.permittedDomains;
            this.restrictedDomains = domainModifier.restrictedDomains;
        }

        this.content = ruleText.substring(index + marker.length).trim();
        if (!this.content) {
            throw new SyntaxError('Empty rule content');
        }

        this.type = this.parseTypeAndWhitelist(marker);
        this.validate();

        this.extendedCss = isExtCssMarker(marker);
        if (!this.extendedCss) {
            // additional check if rule is extended css rule by pseudo class indicators
            for (let i = 0; i < this.EXT_CSS_PSEUDO_INDICATORS.length; i += 1) {
                if (this.content.indexOf(this.EXT_CSS_PSEUDO_INDICATORS[i]) !== -1) {
                    this.extendedCss = true;
                    break;
                }
            }
        }
    }

    /**
     * Match returns true if this rule can be used on the specified domain.
     *
     * @param domain - domain to check
     */
    match(domain: string): boolean {
        if (!this.permittedDomains && !this.restrictedDomains) {
            return true;
        }

        if (this.restrictedDomains != null && this.restrictedDomains.length > 0) {
            if (DomainModifier.isDomainOrSubdomainOfAny(domain, this.restrictedDomains)) {
                // Domain or host is restricted
                // i.e. ~example.org##rule
                return false;
            }
        }

        if (this.permittedDomains != null && this.permittedDomains.length > 0) {
            if (!DomainModifier.isDomainOrSubdomainOfAny(domain, this.permittedDomains)) {
                // Domain is not among permitted
                // i.e. example.org##rule and we're checking example.org
                return false;
            }
        }

        return true;
    }

    private parseTypeAndWhitelist(marker: string): CosmeticRuleType {
        switch (marker) {
            case CosmeticRuleMarker.ElementHiding:
            case CosmeticRuleMarker.ElementHidingExtCSS:
                return CosmeticRuleType.ElementHiding;
            case CosmeticRuleMarker.ElementHidingException:
            case CosmeticRuleMarker.ElementHidingExtCSSException:
                this.whitelist = true;
                return CosmeticRuleType.ElementHiding;
            case CosmeticRuleMarker.Css:
            case CosmeticRuleMarker.CssExtCSS:
                return CosmeticRuleType.Css;
            case CosmeticRuleMarker.CssException:
            case CosmeticRuleMarker.CssExtCSSException:
                this.whitelist = true;
                return CosmeticRuleType.Css;
            case CosmeticRuleMarker.Js:
                return CosmeticRuleType.Js;
            case CosmeticRuleMarker.JsException:
                this.whitelist = true;
                return CosmeticRuleType.Js;
            case CosmeticRuleMarker.Html:
                return CosmeticRuleType.Html;
            case CosmeticRuleMarker.HtmlException:
                this.whitelist = true;
                return CosmeticRuleType.Html;
            default:
                throw new SyntaxError('Unsupported rule type');
        }
    }

    private validate(): void {
        if (this.type !== CosmeticRuleType.Css
            && this.type !== CosmeticRuleType.Js) {
            CosmeticRule.validatePseudoClasses(this.content);

            if (utils.hasUnquotedSubstring(this.content, '{')) {
                throw new SyntaxError(`Invalid cosmetic rule, wrong brackets: ${this.ruleText}`);
            }
        }

        if (this.type === CosmeticRuleType.ElementHiding) {
            CosmeticRule.validateElemhideRule(this.content, this.ruleText);
        }

        if (this.type === CosmeticRuleType.Css) {
            CosmeticRule.validateCssRules(this.content, this.ruleText);
        }

        if (utils.hasUnquotedSubstring(this.content, '/*')
            || utils.hasUnquotedSubstring(this.content, ' //')) {
            throw new SyntaxError(`Invalid cosmetic rule, wrong brackets: ${this.ruleText}`);
        }
    }

    /**
     * Validate pseudo-classes
     *
     * @param ruleContent
     * @throws SyntaxError
     */
    private static validatePseudoClasses(ruleContent: string): void {
        const pseudoClass = CosmeticRule.parsePseudoClass(ruleContent);
        if (pseudoClass !== null) {
            if (CosmeticRule.SUPPORTED_PSEUDO_CLASSES.indexOf(pseudoClass) < 0) {
                throw new SyntaxError(`Unknown pseudo class: ${ruleContent}`);
            }
        }
    }

    /**
     * Simple validation for elemhide rules
     *
     * @param ruleContent
     * @param ruleText
     * @throws SyntaxError
     */
    private static validateElemhideRule(ruleContent: string, ruleText: string): void {
        if (/ {.+}/.test(ruleContent)) {
            throw new SyntaxError(`Invalid elemhide rule, style presented: ${ruleText}`);
        }
    }

    /**
     * Validates css injection rules
     *
     * @param ruleContent
     * @param ruleText
     * @throws SyntaxError
     */
    private static validateCssRules(ruleContent: string, ruleText: string): void {
        // Simple validation for css injection rules
        if (!/ {.+}/.test(ruleContent)) {
            throw new SyntaxError(`Invalid CSS modifying rule, no style presented: ${ruleText}`);
        }
        // discard css inject rules containing "url"
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1196
        if (/url\(.*\)/gi.test(ruleContent)) {
            throw new SyntaxError(`CSS modifying rule with 'url' was omitted: ${ruleText}`);
        }

        // Prohibit "\" character in style of CSS injection rules
        if (ruleContent.indexOf('\\', ruleContent.indexOf('{')) > -1) {
            throw new SyntaxError(`CSS injection rule with '\\' was omitted: ${ruleText}`);
        }
    }
}
