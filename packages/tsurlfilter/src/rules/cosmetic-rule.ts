import scriptlets, { IConfiguration } from '@adguard/scriptlets';
import {
    AnyCosmeticRule,
    COMMA_DOMAIN_LIST_SEPARATOR,
    CosmeticRuleParser,
    CosmeticRuleSeparator,
    CosmeticRuleSeparatorUtils,
    CosmeticRuleType,
    DomainList,
    DomainUtils,
    PIPE_MODIFIER_SEPARATOR,
    QuoteUtils,
} from '@adguard/agtree';

import * as rule from './rule';
import { DomainModifier } from '../modifiers/domain-modifier';
import { getRelativeUrl } from '../utils/url';
import { SimpleRegex } from './simple-regex';
import { Request } from '../request';
import { Pattern } from './pattern';
import { config } from '../configuration';
import { EMPTY_STRING, SPACE, WILDCARD } from '../common/constants';
import { validateSelectorList } from './css/selector-list-validator';
import { validateDeclarationList } from './css/declaration-list-validator';
import { getErrorMessage } from '../common/error';
import { hasUnquotedSubstring } from '../utils/string-utils';

const MULTILINE_COMMENT_MARKER = '/*';
const SINGLELINE_COMMENT_MARKER = '//';

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
 * Represents possible modifiers for cosmetic rules.
 */
const enum CosmeticRuleModifier {
    /**
     * $domain modifier
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#non-basic-domain-modifier}
     */
    Domain = 'domain',

    /**
     * $path modifier
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#non-basic-path-modifier}
     */
    Path = 'path',

    /**
     * $url modifier
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#non-basic-url-modifier}
     */
    Url = 'url',
}

/**
 * Represents a cosmetic rule validation result.
 */
interface ValidationResult {
    /**
     * Boolean flag indicating whether the rule is valid.
     */
    isValid: boolean;

    /**
     * Boolean flag indicating whether the rule is ExtendedCss.
     */
    isExtendedCss: boolean;

    /**
     * Error message if the rule is invalid.
     */
    errorMessage?: string;
}

/**
 * Represents raw parts of the rule (rule text & body text)
 */
interface Raws {
    /**
     * Whole rule text
     * @example `example.org##.banner`
     */
    ruleText: string;

    /**
     * Rule body text
     * @example `.banner` (for `example.org##.banner`)
     */
    bodyText: string;
}

/**
 * Represents the rule with raws (helper function return type)
 */
interface RuleWithRaws {
    /**
     * Rule node
     */
    ruleNode: AnyCosmeticRule;

    /**
     * Rule raws, see {@link Raws}
     */
    ruleRaws: Raws;
}

/**
 * Represents processed modifiers
 */
interface ProcessedModifiers {
    domainModifier?: DomainModifier;
    pathModifier?: Pattern;
    urlModifier?: Pattern;
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
     * Scriptlet parameters
     */
    private scriptletParams: string[] | null = null;

    /**
     * If the rule contains scriptlet content
     */
    public isScriptlet = false;

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
     * Helper method to get the rule's raws. If the rule has its own raws, then
     * they are returned without any computation. Otherwise, the raws are generated
     * from the rule node, because we need the whole rule text & body text.
     *
     * @param ruleNode Cosmetic rule node
     * @returns Raw parts of the rule (rule text & body text) ({@see Raws})
     */
    private static getRuleRaws(ruleNode: AnyCosmeticRule): Raws {
        // Check if the rule has its own raws. If so, then we can just return them.
        if ((ruleNode.raws && ruleNode.raws.text) && (ruleNode.body.raw)) {
            return ({
                ruleText: ruleNode.raws.text,
                bodyText: ruleNode.body.raw,
            });
        }

        // If not, then we should generate them from the rule node.
        // Note: since we need the whole rule text & body text, we
        // need to generate rule parts separately in order to avoid
        // double generation of the body text.
        const ruleText: string[] = [];

        ruleText.push(CosmeticRuleParser.generatePattern(ruleNode));
        ruleText.push(ruleNode.separator.value);
        const bodyText = CosmeticRuleParser.generateBody(ruleNode);
        ruleText.push(bodyText);

        return ({
            ruleText: ruleText.join(EMPTY_STRING),
            bodyText,
        });
    }

    /**
     * Helper method to get the rule node and its raws.
     *
     * @param ruleText Input rule text
     * @returns Rule node and its raws ({@link RuleWithRaws})
     * @throws Error if the rule is not a valid cosmetic rule
     */
    private static getRuleNodeAndRaws(ruleText: string): RuleWithRaws {
        // Parse the rule - this will throw an error if the rule is syntactically invalid
        const ruleNode = CosmeticRuleParser.parse(ruleText, {
            isLocIncluded: false,
            parseAbpSpecificRules: false,
            parseUboSpecificRules: false,
        });

        // Parser might returns 'null' which means that the given rule is not a known cosmetic rule.
        // In this case, we should throw an error.
        if (!ruleNode) {
            throw new SyntaxError('Not a cosmetic rule');
        }

        // Get the rule raws
        const ruleRaws = CosmeticRule.getRuleRaws(ruleNode);

        return ({
            ruleNode,
            ruleRaws,
        });
    }

    /**
     * Processes cosmetic rule modifiers, e.g. `$path`.
     *
     * @param ruleNode Cosmetic rule node to process
     * @returns Processed modifiers ({@link ProcessedModifiers})
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#modifiers-for-non-basic-type-of-rules}
     */
    private static processModifiers(ruleNode: AnyCosmeticRule): ProcessedModifiers {
        const result: ProcessedModifiers = {};

        // Do nothing if there are no modifiers in the rule node
        if (!ruleNode.modifiers) {
            return result;
        }

        // We don't allow duplicate modifiers, so we collect them in a set
        const usedModifiers = new Set<string>();

        // Destructure the modifiers array just for convenience
        const { children: modifierNodes } = ruleNode.modifiers;

        // AGTree parser tolerates this case: [$]example.com##.foo
        // However, we should throw an error here if the modifier list is empty
        // (if the modifier list isn't specified at all, then ruleNode.modifiers
        // will be undefined, so we won't get here)
        if (modifierNodes.length < 1) {
            throw new SyntaxError('Modifiers list cannot be be empty');
        }

        for (const modifierNode of modifierNodes) {
            const modifierName = modifierNode.name.value;

            // Check if the modifier is already used
            if (usedModifiers.has(modifierName)) {
                throw new Error(`Duplicated modifier: '${modifierName}'`);
            }

            // Mark the modifier as used by adding it to the set
            usedModifiers.add(modifierName);

            const modifierValue = modifierNode.value?.value || EMPTY_STRING;

            // Every modifier should have a value at the moment, so for simplicity we throw an error here if the
            // modifier value is not present.
            // TODO: Improve this when we decide to add modifiers without values
            if (modifierValue.length < 1 && modifierName !== CosmeticRuleModifier.Path) {
                throw new SyntaxError(`'$${modifierName}' modifier should have a value`);
            }

            // Process the modifier based on its name
            switch (modifierName) {
                case CosmeticRuleModifier.Domain:
                    if (ruleNode.domains.children.length > 0) {
                        throw new SyntaxError(`'$${modifierName}' modifier is not allowed in a domain-specific rule`);
                    }

                    result.domainModifier = new DomainModifier(modifierValue, PIPE_MODIFIER_SEPARATOR);
                    break;

                case CosmeticRuleModifier.Path:
                    result.pathModifier = new Pattern(
                        SimpleRegex.isRegexPattern(modifierValue)
                            // eslint-disable-next-line max-len
                            ? SimpleRegex.unescapeRegexSpecials(modifierValue, SimpleRegex.reModifierPatternEscapedSpecialCharacters)
                            : modifierValue,
                    );
                    break;

                case CosmeticRuleModifier.Url:
                    if (ruleNode.domains.children.length > 0) {
                        throw new SyntaxError(`'$${modifierName}' modifier is not allowed in a domain-specific rule`);
                    }

                    result.urlModifier = new Pattern(
                        SimpleRegex.isRegexPattern(modifierValue)
                            // eslint-disable-next-line max-len
                            ? SimpleRegex.unescapeRegexSpecials(modifierValue, SimpleRegex.reModifierPatternEscapedSpecialCharacters)
                            : modifierValue,
                    );
                    break;

                // Don't allow unknown modifiers
                default:
                    throw new SyntaxError(`'$${modifierName}' modifier is not supported`);
            }
        }

        // $url modifier can't be used with other modifiers
        // TODO: Extend / change this check if we decide to add more such modifiers
        if (result.urlModifier && usedModifiers.size > 1) {
            throw new SyntaxError(`'$${CosmeticRuleModifier.Url}' modifier cannot be used with other modifiers`);
        }

        return result;
    }

    /**
     * Validates cosmetic rule node.
     *
     * @param ruleNode Cosmetic rule node to validate
     * @returns Validation result ({@link ValidationResult})
     */
    private static validate(ruleNode: AnyCosmeticRule): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            isExtendedCss: false,
        };

        let scriptletName;
        let selectorListValidationResult;
        const { type: ruleType } = ruleNode;

        try {
            // Common validation: every cosmetic rule has a domain list
            if (ruleNode.domains?.children.length) {
                // Iterate over the domain list and check every domain
                for (const { value: domain } of ruleNode.domains.children) {
                    if (!DomainUtils.isValidDomainOrHostname(domain)) {
                        throw new Error(`'${domain}' is not a valid domain name`);
                    }
                }
            }

            const { bodyText } = CosmeticRule.getRuleRaws(ruleNode);

            // Type-specific validation
            switch (ruleType) {
                case CosmeticRuleType.ElementHidingRule:
                    selectorListValidationResult = validateSelectorList(ruleNode.body.selectorList.value);

                    if (!selectorListValidationResult.isValid) {
                        throw new Error(selectorListValidationResult.errorMessage);
                    }

                    // Detect ExtendedCss and unsupported pseudo-classes
                    result.isExtendedCss = selectorListValidationResult.isExtendedCss;
                    break;

                case CosmeticRuleType.CssInjectionRule:
                    selectorListValidationResult = validateSelectorList(ruleNode.body.selectorList.value);

                    if (!selectorListValidationResult.isValid) {
                        throw new Error(selectorListValidationResult.errorMessage);
                    }

                    // Detect ExtendedCss and unsupported pseudo-classes
                    result.isExtendedCss = selectorListValidationResult.isExtendedCss;

                    // AGTree won't allow the following rule:
                    // `#$#selector { remove: true; padding: 0; }`
                    // because it mixes removal and non-removal declarations.
                    if (ruleNode.body.declarationList) {
                        // eslint-disable-next-line max-len
                        const declarationListValidationResult = validateDeclarationList(ruleNode.body.declarationList.value);

                        if (!declarationListValidationResult.isValid) {
                            throw new Error(declarationListValidationResult.errorMessage);
                        }

                        // If the selector list is not ExtendedCss, then we should set this flag based on the
                        // declaration list validation result
                        if (!result.isExtendedCss) {
                            result.isExtendedCss = declarationListValidationResult.isExtendedCss;
                        }
                    }
                    break;

                case CosmeticRuleType.ScriptletInjectionRule:
                    // Scriptlet name is the first child of the parameter list
                    scriptletName = QuoteUtils.removeQuotes(ruleNode.body.children[0]?.children[0]?.value);

                    if (!scriptletName) {
                        throw new Error('Scriptlet name should be specified');
                    }

                    // Check if the scriptlet name is valid
                    if (!scriptlets.isValidScriptletName(scriptletName)) {
                        throw new Error(`'${scriptletName}' is not a known scriptlet name`);
                    }
                    break;

                case CosmeticRuleType.HtmlFilteringRule:
                    // TODO: Validate HTML filtering rules
                    break;

                case CosmeticRuleType.JsInjectionRule:
                    // TODO: Validate JS injection rules
                    break;

                default:
                    break;
            }

            if (
                (!result.isExtendedCss && hasUnquotedSubstring(bodyText, MULTILINE_COMMENT_MARKER))
                || hasUnquotedSubstring(bodyText, SPACE + MULTILINE_COMMENT_MARKER)
                || hasUnquotedSubstring(bodyText, SPACE + SINGLELINE_COMMENT_MARKER)
            ) {
                throw new SyntaxError('Cosmetic rule should not contain comments');
            }
        } catch (error: unknown) {
            result.isValid = false;
            result.errorMessage = getErrorMessage(error);
        }

        return result;
    }

    /**
     * Checks if the domain list contains any domains, but returns `false` if only
     * the wildcard domain is specified.
     *
     * @param domainListNode Domain list node to check
     * @returns `true` if the domain list contains any domains, `false` otherwise
     */
    private static isAnyDomainSpecified(domainListNode: DomainList): boolean {
        if (domainListNode.children.length > 0) {
            // Skip wildcard domain list (*)
            return !(domainListNode.children.length === 1 && domainListNode.children[0].value === WILDCARD);
        }

        return false;
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
        // Parse the rule and get the raws
        const { ruleNode, ruleRaws } = CosmeticRule.getRuleNodeAndRaws(ruleText.trim());

        this.filterListId = filterListId;

        this.ruleText = ruleRaws.ruleText;
        this.content = ruleRaws.bodyText;

        this.allowlist = CosmeticRuleSeparatorUtils.isException(ruleNode.separator.value as CosmeticRuleSeparator);
        this.type = ruleNode.type;
        this.isScriptlet = ruleNode.type === CosmeticRuleType.ScriptletInjectionRule;

        // Store the scriptlet parameters. They will be used later, when we initialize the scriptlet,
        // but at this point we need to store them in order to avoid double parsing
        if (ruleNode.type === CosmeticRuleType.ScriptletInjectionRule) {
            // Perform some quick checks just in case
            if (ruleNode.body.children.length !== 1 || ruleNode.body.children[0].children.length < 1) {
                throw new SyntaxError('Scriptlet rule should have at least one parameter');
            }

            // Transform complex node into a simple array of strings
            this.scriptletParams = ruleNode.body.children[0].children.map(
                ({ value }) => QuoteUtils.removeQuotes(value),
            );
        }

        const validationResult = CosmeticRule.validate(ruleNode);

        // We should throw an error if the validation failed for any reason
        if (!validationResult.isValid) {
            throw new SyntaxError(validationResult.errorMessage);
        }

        // Check if the rule is ExtendedCss
        const isExtendedCssSeparator = CosmeticRuleSeparatorUtils.isExtendedCssMarker(
            ruleNode.separator.value as CosmeticRuleSeparator,
        );

        this.extendedCss = isExtendedCssSeparator || validationResult.isExtendedCss;

        // Process cosmetic rule modifiers
        const { domainModifier, pathModifier, urlModifier } = CosmeticRule.processModifiers(ruleNode);

        if (domainModifier) {
            this.domainModifier = domainModifier;
        }

        if (pathModifier) {
            this.pathModifier = pathModifier;
        }

        if (urlModifier) {
            this.urlModifier = urlModifier;
        }

        // Process domain list, if at least one domain is specified
        const { domains: domainListNode } = ruleNode;

        if (CosmeticRule.isAnyDomainSpecified(domainListNode)) {
            this.domainModifier = new DomainModifier(domainListNode, COMMA_DOMAIN_LIST_SEPARATOR);
        }
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

        if (!this.scriptletParams || this.scriptletParams.length < 1) {
            throw new Error('At least the scriptlet name should be specified');
        }

        const params: scriptlets.IConfiguration = {
            args: this.scriptletParams.slice(1),
            engine: config.engine || EMPTY_STRING,
            name: this.scriptletParams[0],
            ruleText: this.getText(),
            verbose: debug,
            domainName: frameUrl,
            version: config.version || EMPTY_STRING,
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
