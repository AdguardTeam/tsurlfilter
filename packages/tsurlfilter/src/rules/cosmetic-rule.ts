import scriptlets, { IConfiguration } from '@adguard/scriptlets';
import * as rule from './rule';
import { CosmeticRuleMarker, isExtCssMarker, ADG_SCRIPTLET_MASK } from './cosmetic-rule-marker';
import { DomainModifier } from '../modifiers/domain-modifier';
import { hasUnquotedSubstring, indexOfAny } from '../utils/string-utils';
import { getRelativeUrl } from '../utils/url';
import { SimpleRegex } from './simple-regex';
import { CosmeticRuleParser, isUrlPatternResult } from './cosmetic-rule-parser';
import { Request } from '../request';
import { Pattern } from './pattern';
import { ScriptletParser } from '../engine/cosmetic-engine/scriptlet-parser';
import { config } from '../configuration';

/**
 * Init script params
 */
interface InitScriptParams {
    debug?: boolean,
    frameUrl?: string
}

/**
 * Get scriptlet data response type
 */
export type ScriptletData = {
    params: IConfiguration,
    func: (source: scriptlets.IConfiguration, args: string[]) => void
};

/**
 * Script data type
 */
type ScriptData = {
    code: string | null,
    debug?: boolean,
    frameUrl?: string
};

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
 * Pseudo class indicators. They are used to detect if rule is extended or not even if rule does not
 * have extended css marker
 */
export const EXT_CSS_PSEUDO_INDICATORS = [
    /**
     * Pseudo-classes :is(), and :not() may use native implementation
     * so they are not listed here
     * https://github.com/AdguardTeam/ExtendedCss#extended-css-is
     * https://github.com/AdguardTeam/ExtendedCss#extended-css-not
     */
    /**
     * :has() should also be conditionally considered as extended and should not be in this list
     * https://github.com/AdguardTeam/ExtendedCss#extended-css-has
     * but there is a bug with content blocker in safari
     * https://bugs.webkit.org/show_bug.cgi?id=248868
     *
     * TODO: remove ':has(' later
     */
    ':has(',
    ':contains(',
    ':matches-css(',
    ':matches-attr(',
    ':matches-property(',
    ':xpath(',
    ':upward(',
    ':nth-ancestor(',
    ':remove(',
    // aliases for :has()
    ':-abp-has(',
    // aliases for :contains()
    ':has-text(',
    ':-abp-contains(',
    // old syntax
    '[-ext-has=',
    '[-ext-contains=',
    '[-ext-has-text=',
    '[-ext-matches-css=',
    '[-ext-matches-css-before=',
    '[-ext-matches-css-after=',
    // obsolete since ExtendedCss v2.0.2 but still compatible
    // https://github.com/AdguardTeam/ExtendedCss/releases/tag/v2.0.2
    ':matches-css-before(',
    ':matches-css-after(',
];

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

    private allowlist = false;

    private extendedCss = false;

    /**
     * $domain modifier pattern. It is only set if $domain modifier is specified for this rule.
     */
    private domainModifier: DomainModifier | null = null;

    /**
     * $path modifier pattern. It is only set if $path modifier is specified for this rule.
     */
    public pathModifier: Pattern | undefined;

    /**
     * $url modifier pattern. It is only set if $url modifier is specified for this rule,
     * but $path and $domain modifiers are not.
     *
     * TODO add this to test cases
     */
    public urlModifier: Pattern | undefined;

    /**
     * Js script to execute
     */
    public script: string | undefined = undefined;

    /**
     * Object with script code ready to execute and debug, domain values
     * @private
     */
    private scriptData: ScriptData | null = null;

    /**
     * Object with scriptlet function and params
     * @private
     */
    private scriptletData: ScriptletData | null = null;

    /**
     * If the rule contains scriptlet content
     */
    public isScriptlet = false;

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
        ':-abp-has', ':-abp-contains', ':xpath', ':nth-ancestor', ':upward', ':remove',
        ':matches-attr', ':matches-property', ':is', ':where'];

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

        let nameEndIndex = indexOfAny(
            selector,
            [' ', ',', '\t', '>', '(', '[', '.', '#', ':', '+', '~', '"', '\''],
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
     * Allowlist means that this rule is meant to disable other rules.
     * For instance, https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#elemhide-exceptions
     */
    isAllowlist(): boolean {
        return this.allowlist;
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
     * Returns script ready to execute or null
     * Rebuilds scriptlet script if debug or domain params change
     * @param options script options
     * @returns script code or null
     */
    getScript(options: InitScriptParams = {}): string | null {
        const { debug = false, frameUrl } = options;
        const { scriptData } = this;

        if (scriptData && !this.isScriptlet) {
            return scriptData.code;
        }

        if (scriptData && scriptData.debug === debug) {
            if (frameUrl) {
                if (frameUrl === scriptData.frameUrl) {
                    return scriptData.code;
                }
            } else {
                return scriptData.code;
            }
        }

        this.initScript(options);

        return this.scriptData?.code ?? null;
    }

    /**
     * Gets list of permitted domains.
     */
    getPermittedDomains(): string[] | null {
        if (this.domainModifier) {
            return this.domainModifier.getPermittedDomains();
        }
        return null;
    }

    /**
     * Gets list of restricted domains.
     */
    getRestrictedDomains(): string[] | null {
        if (this.domainModifier) {
            return this.domainModifier.getRestrictedDomains();
        }
        return null;
    }

    /**
     * Returns true if the rule is considered "generic"
     * "generic" means that the rule is not restricted to a limited set of domains
     * Please note that it might be forbidden on some domains, though.
     *
     * @return {boolean}
     */
    isGeneric(): boolean {
        return !this.domainModifier?.hasPermittedDomains();
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

        const {
            pattern,
            marker,
            content,
        } = CosmeticRuleParser.parseRuleTextByMarker(ruleText);

        this.content = content;
        this.type = CosmeticRule.parseType(marker);

        this.extendedCss = isExtCssMarker(marker);
        if (!this.extendedCss
            && (this.type === CosmeticRuleType.ElementHiding
                || this.type === CosmeticRuleType.Css)) {
            // additional check if rule is extended css rule by pseudo class indicators
            for (let i = 0; i < EXT_CSS_PSEUDO_INDICATORS.length; i += 1) {
                if (this.content.indexOf(EXT_CSS_PSEUDO_INDICATORS[i]) !== -1) {
                    this.extendedCss = true;
                    break;
                }
            }
        }

        CosmeticRule.validate(ruleText, this.type, content, this.extendedCss);

        if (pattern) {
            // This means that the marker is preceded by the list of domains and modifiers
            // Now it's a good time to parse them.
            const parsedPattern = CosmeticRuleParser.parseRulePattern(pattern);

            if (isUrlPatternResult(parsedPattern)) {
                this.urlModifier = new Pattern(parsedPattern.url);
            } else {
                const { path, domainModifier } = parsedPattern;
                if (path || path === '') {
                    this.pathModifier = new Pattern(path);
                }

                if (domainModifier) {
                    this.domainModifier = domainModifier;
                }
            }
        }

        this.allowlist = CosmeticRule.parseAllowlist(marker);
        this.isScriptlet = this.content.startsWith(ADG_SCRIPTLET_MASK);
    }

    /**
     * Match returns true if this rule can be used on the specified request.
     *
     * @param request - request to check
     */
    match(request: Request): boolean {
        if (!this.domainModifier
            && !this.pathModifier
            && !this.urlModifier
        ) {
            return true;
        }

        if (this.urlModifier) {
            return this.urlModifier.matchPattern(request, false);
        }

        if (this.domainModifier) {
            if (!this.domainModifier.matchDomain(request.hostname)) {
                return false;
            }
        }

        if (this.pathModifier) {
            const path = getRelativeUrl(request.urlLowercase);
            if (path) {
                return this.pathModifier.matchPathPattern(path);
            }

            return false;
        }

        return true;
    }

    static parseType(marker: string): CosmeticRuleType {
        switch (marker) {
            case CosmeticRuleMarker.ElementHiding:
            case CosmeticRuleMarker.ElementHidingExtCSS:
                return CosmeticRuleType.ElementHiding;
            case CosmeticRuleMarker.ElementHidingException:
            case CosmeticRuleMarker.ElementHidingExtCSSException:
                return CosmeticRuleType.ElementHiding;
            case CosmeticRuleMarker.Css:
            case CosmeticRuleMarker.CssExtCSS:
                return CosmeticRuleType.Css;
            case CosmeticRuleMarker.CssException:
            case CosmeticRuleMarker.CssExtCSSException:
                return CosmeticRuleType.Css;
            case CosmeticRuleMarker.Js:
                return CosmeticRuleType.Js;
            case CosmeticRuleMarker.JsException:
                return CosmeticRuleType.Js;
            case CosmeticRuleMarker.Html:
                return CosmeticRuleType.Html;
            case CosmeticRuleMarker.HtmlException:
                return CosmeticRuleType.Html;
            default:
                throw new SyntaxError('Unsupported rule type');
        }
    }

    /**
     * Determines if rule is allowlist rule
     * @param marker
     * @private
     */
    private static parseAllowlist(marker: string): boolean {
        switch (marker) {
            case CosmeticRuleMarker.ElementHidingException:
            case CosmeticRuleMarker.ElementHidingExtCSSException:
            case CosmeticRuleMarker.CssException:
            case CosmeticRuleMarker.CssExtCSSException:
            case CosmeticRuleMarker.JsException:
            case CosmeticRuleMarker.HtmlException:
                return true;
            default:
                return false;
        }
    }

    /**
     * Validate pseudo-classes
     *
     * @param ruleText
     * @param ruleContent
     * @throws SyntaxError
     */
    private static validatePseudoClasses(ruleText: string, ruleContent: string): void {
        const pseudoClass = CosmeticRule.parsePseudoClass(ruleContent);
        if (pseudoClass !== null) {
            if (CosmeticRule.SUPPORTED_PSEUDO_CLASSES.indexOf(pseudoClass) < 0) {
                throw new SyntaxError(`Unknown pseudo-class '${pseudoClass}' in selector: '${ruleContent}'`);
            }
        }
    }

    private static ELEMHIDE_VALIDATION_REGEX = / {.+}/;

    /**
     * Simple validation for elemhide rules
     *
     * @param ruleText
     * @param ruleContent
     * @throws SyntaxError
     */
    private static validateElemhideRule(ruleText: string, ruleContent: string): void {
        if (ruleText.startsWith(SimpleRegex.MASK_START_URL)) {
            throw new SyntaxError('Element hiding rule shouldn\'t start with "||"');
        }
        if (CosmeticRule.ELEMHIDE_VALIDATION_REGEX.test(ruleContent)) {
            throw new SyntaxError('Invalid elemhide rule, style presented');
        }
    }

    private static validateJsRules(ruleText: string, ruleContent: string): void {
        if (ruleContent.startsWith(ADG_SCRIPTLET_MASK)) {
            if (!scriptlets.isValidScriptletRule(ruleText)) {
                throw new SyntaxError('Invalid scriptlet');
            }
        }
    }

    /**
     * Validates css injection rules
     *
     * @param ruleText
     * @param ruleContent
     * @throws SyntaxError
     */
    private static validateCssRules(ruleText: string, ruleContent: string): void {
        // Simple validation for css injection rules
        if (!/{.+}/.test(ruleContent)) {
            throw new SyntaxError('Invalid CSS modifying rule, no style presented');
        }
        // discard css inject rules containing "url"
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1196
        if (/{.*url\(.*\)/gi.test(ruleContent)) {
            throw new SyntaxError('CSS modifying rule with \'url\' was omitted');
        }

        // discard css inject rules containing other unsafe selectors
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1920
        if (/{.*image-set\(.*\)/gi.test(ruleContent)
            || /{.*image\(.*\)/gi.test(ruleContent)
            || /{.*cross-fade\(.*\)/gi.test(ruleContent)) {
            throw new SyntaxError('CSS modifying rule with unsafe style was omitted');
        }

        // Prohibit "\" character in style of CSS injection rules
        // Check slash character only after the index of last opening curly brackets
        if (ruleContent.indexOf('\\', ruleContent.lastIndexOf('{')) > -1) {
            throw new SyntaxError('CSS injection rule with \'\\\' was omitted');
        }
    }

    /**
     * Validates cosmetic rule text
     * @param ruleText
     * @param type
     * @param content
     * @param isExtCss
     * @private
     */
    private static validate(ruleText: string, type: CosmeticRuleType, content: string, isExtCss: boolean): void {
        if (type !== CosmeticRuleType.Css
            && type !== CosmeticRuleType.Js
            && type !== CosmeticRuleType.Html) {
            CosmeticRule.validatePseudoClasses(ruleText, content);

            if (hasUnquotedSubstring(content, '{')) {
                throw new SyntaxError('Invalid cosmetic rule, wrong brackets');
            }
        }

        if (type === CosmeticRuleType.ElementHiding) {
            CosmeticRule.validateElemhideRule(ruleText, content);
        }

        if (type === CosmeticRuleType.Css) {
            CosmeticRule.validateCssRules(ruleText, content);
        }

        if (type === CosmeticRuleType.Js) {
            CosmeticRule.validateJsRules(ruleText, content);
        }

        if ((!isExtCss && hasUnquotedSubstring(content, '/*'))
            || hasUnquotedSubstring(content, ' /*')
            || hasUnquotedSubstring(content, ' //')) {
            throw new SyntaxError('Cosmetic rule should not contain comments');
        }
    }

    /**
     * Returns the scriptlet's data consisting of the scriptlet function and its arguments.
     * This method is supposed to be used in the manifest V3 extension.
     */
    getScriptletData(): ScriptletData | null {
        if (this.scriptletData) {
            return this.scriptletData;
        }

        this.initScript();

        return this.scriptletData;
    }

    /**
     * Updates this.scriptData and if scriptlet this.scriptletData with js ready to execute
     *
     * @param options
     */
    initScript(options: InitScriptParams = {}) {
        const { debug = false, frameUrl } = options;
        const ruleContent = this.getContent();
        if (!this.isScriptlet) {
            this.scriptData = {
                code: ruleContent,
            };
            return;
        }

        const scriptletContent = ruleContent.substring(ADG_SCRIPTLET_MASK.length);
        const scriptletParams = ScriptletParser.parseRule(scriptletContent);

        const params: scriptlets.IConfiguration = {
            args: scriptletParams.args,
            engine: config.engine || '',
            name: scriptletParams.name,
            ruleText: this.getText(),
            verbose: debug,
            domainName: frameUrl,
            version: config.version || '',
        };

        this.scriptData = {
            code: scriptlets.invoke(params) ?? null,
            debug,
            frameUrl,
        };

        this.scriptletData = {
            func: scriptlets.getScriptletFunction(params.name),
            params,
        };
    }
}
