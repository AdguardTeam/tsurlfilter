import * as rule from './rule';
import { CosmeticRuleMarker, findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { DomainModifier } from './domain-modifier';

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
    CSS,

    /**
     * Cosmetic rules that allow executing custom JS scripts.
     * Some restrictions are applied to this type of rules by default.
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#javascript-rules
     */
    JS,

    /**
     * A subset of JS rules that allows executing a special JS function on a web page.
     * https://github.com/AdguardTeam/Scriptlets
     */
    Scriptlet,

    /**
     * Special type of rules that allows filtering HTML code of web pages.
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#html-filtering-rules
     */
    HTML,
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

    private permittedDomains: string[] | null = null;

    private restrictedDomains: string[] | null = null;

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
     * Gets list of restricted domains.
     */
    getRestrictedDomains(): string[] | null {
        return this.restrictedDomains;
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

        const markerResult = findCosmeticRuleMarker(ruleText);
        const index = markerResult[0];
        const marker = markerResult[1];

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

        switch (marker) {
            case CosmeticRuleMarker.ElementHiding:
                this.type = CosmeticRuleType.ElementHiding;
                break;
            case CosmeticRuleMarker.ElementHidingException:
                this.type = CosmeticRuleType.ElementHiding;
                this.whitelist = true;
                break;
            default:
                // TODO: Start supporting other types
                throw new SyntaxError('Unsupported rule type');
        }

        if (this.whitelist && (this.permittedDomains === null || this.permittedDomains.length === 0)) {
            throw new SyntaxError('Whitelist rule must have at least one domain specified');
        }

        // TODO: validate content
        // TODO: detect ExtCSS pseudo-classes
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
}
