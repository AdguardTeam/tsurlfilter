/* eslint-disable max-classes-per-file */
import {
    ADG_SCRIPTLET_MASK,
    type AnyCosmeticRule,
    COMMA_DOMAIN_LIST_SEPARATOR,
    type CosmeticRuleSeparator,
    CosmeticRuleSeparatorUtils,
    CosmeticRuleType,
    type DomainList,
    DomainUtils,
    PIPE_MODIFIER_SEPARATOR,
    QuoteType,
    QuoteUtils,
    RegExpUtils,
    type SelectorCombinatorValue,
} from '@adguard/agtree';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';
import { CosmeticRuleParser, defaultParserOptions, type ParserOptions } from '@adguard/agtree/parser';
import { scriptlets, type Source } from '@adguard/scriptlets';
import { isValidScriptletName } from '@adguard/scriptlets/validators';

import { EMPTY_STRING, WILDCARD } from '../common/constants';
import { getErrorMessage } from '../common/error';
import { config } from '../configuration';
import { DomainModifier } from '../modifiers/domain-modifier';
import { type Request } from '../request';
import { getRelativeUrl } from '../utils/url';

import { validateDeclarationList } from './css/declaration-list-validator';
import { validateSelectorList } from './css/selector-list-validator';
import { Pattern } from './pattern';
import { FILTER_LIST_ID_NONE, type IRule, RULE_INDEX_NONE } from './rule';
import { SimpleRegex } from './simple-regex';

/**
 * Init script params.
 */
interface InitScriptParams {
    debug?: boolean;
    frameUrl?: string;
}

/**
 * Get scriptlet data response type.
 */
export type ScriptletData = {
    params: Source;
    func: (source: Source, args: string[]) => void;
};

/**
 * Script data type.
 */
type ScriptData = {
    code: string | null;
    debug?: boolean;
    frameUrl?: string;
};

/**
 * Represents scriptlet properties parsed from the rule content.
 */
export type ScriptletsProps = {
    name: string;
    args: string[];
};

/**
 * Represents scriptlet properties parsed from the rule content.
 */
class ScriptletParams {
    /**
     * Scriptlet properties.
     */
    private props: ScriptletsProps | null = null;

    /**
     * ScriptletParams constructor.
     *
     * @param name Scriptlet name.
     * @param args Scriptlet arguments.
     */
    constructor(name?: string, args?: string[]) {
        if (typeof name !== 'undefined') {
            this.props = {
                name,
                args: args || [],
            };
        }
    }

    /**
     * Gets scriptlet name.
     *
     * @returns Scriptlet name.
     */
    public get name(): string | undefined {
        return this.props?.name;
    }

    /**
     * Gets scriptlet arguments.
     *
     * @returns Scriptlet arguments.
     */
    public get args(): string[] {
        return this.props?.args ?? [];
    }

    /**
     * Gets string representation of scriptlet parameters.
     *
     * @returns String representation of scriptlet parameters.
     */
    public toString(): string {
        const result: string[] = [];

        result.push(ADG_SCRIPTLET_MASK);
        result.push('(');

        if (this.name) {
            result.push(QuoteUtils.setStringQuoteType(this.name, QuoteType.Single));
        }

        if (this.args.length) {
            result.push(', ');
            result.push(this.args.map((arg) => QuoteUtils.setStringQuoteType(arg, QuoteType.Single)).join(', '));
        }

        result.push(')');

        return result.join(EMPTY_STRING);
    }
}

/**
 * Represents special selector names used in HTML filtering rules.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 *
 * @note Special attribute selectors (e.g. `[tag-content="content"]`) are not included here
 * as they are deprecated and will be removed in future versions, in AGTree converter they
 * are converted to `:contains(content)` special pseudo-class selector.
 */
export enum HtmlSpecialSelectorName {
    /**
     * `:contains(content)` special selector.
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules--contains}
     */
    Contains = 'contains',
}

/**
 * Represents processed special selector used in HTML filtering rules.
 */
export interface HtmlSpecialSelector {
    /**
     * The name of the special selector.
     */
    name: HtmlSpecialSelectorName;

    /**
     * The value of the special selector.
     */
    value: string | RegExp;
}

/**
 * Represents HTML filtering rule selector.
 */
export interface HtmlSelector {
    /**
     * Combinator used to combine with the previous selector.
     */
    combinator?: SelectorCombinatorValue;

    /**
     * Native CSS selector part of the selector.
     */
    nativeSelector: string;

    /**
     * List of special selectors used in the selector.
     */
    specialSelectors: HtmlSpecialSelector[];
}

/**
 * Represents HTML filtering rule selector list.
 */
export interface HtmlSelectorList {
    /**
     * Selectors that make up the selector list.
     * First dimension represents different complex selectors separated by commas.
     * Second dimension represents compound selectors within a complex selector separated by combinators.
     */
    selectors: HtmlSelector[][];
}

/**
 * Represents possible modifiers for cosmetic rules.
 */
const enum CosmeticRuleModifier {
    /**
     * `$domain` modifier.
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#non-basic-domain-modifier}
     */
    Domain = 'domain',

    /**
     * `$path` modifier.
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#non-basic-path-modifier}
     */
    Path = 'path',

    /**
     * `$url` modifier.
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
 * Represents processed modifiers.
 */
interface ProcessedModifiers {
    domainModifier?: DomainModifier;
    pathModifier?: Pattern;
    urlModifier?: Pattern;
}

/**
 * @typedef {import('./cosmetic-result').CosmeticResult} CosmeticResult
 */

/**
 * Implements a basic cosmetic rule.
 *
 * Cosmetic rules syntax are almost similar and looks like this.
 * ```
 * rule = [domains] "marker" content
 * domains = [domain0, domain1[, ...[, domainN]]]
 * ```
 *
 * The rule type is defined by the `type` property, you can find the list of them
 * in the {@link CosmeticRuleType} enumeration.
 *
 * What matters, though, is what's in the `content` part of it.
 *
 * @example
 * `example.org##.banner` -- element hiding rule
 * `example.org#$#.banner { display: block; }` -- CSS rule
 * `example.org#%#window.x=1;` -- JS rule
 * `example.org#%#//scriptlet('scriptlet-name')` -- Scriptlet rule
 * `example.org$$div[id="test"]` -- HTML filtering rule
 */
export class CosmeticRule implements IRule {
    /**
     * Parser options for cosmetic rules.
     */
    private static readonly PARSER_OPTIONS: ParserOptions = {
        ...defaultParserOptions,
        parseAbpSpecificRules: false,
        parseUboSpecificRules: false,
        isLocIncluded: false,
        parseHtmlFilteringRuleBodies: true,
    };

    /**
     * Rule index.
     */
    private readonly ruleIndex: number;

    /**
     * Filter list ID.
     */
    private readonly filterListId: number;

    /**
     * Rule text.
     */
    private readonly ruleText?: string;

    /**
     * Rule content.
     */
    private readonly content: string;

    /**
     * Rule type.
     */
    private readonly type: CosmeticRuleType;

    /**
     * Allowlist flag.
     */
    private allowlist = false;

    /**
     * Extended CSS flag.
     */
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
     * TODO: add this to test cases.
     */
    public urlModifier: Pattern | undefined;

    /**
     * Js script to execute.
     */
    public script: string | undefined = undefined;

    /**
     * Object with script code ready to execute and debug, domain values.
     *
     * @private
     */
    private scriptData: ScriptData | null = null;

    /**
     * Object with scriptlet function and params.
     *
     * @private
     */
    private scriptletData: ScriptletData | null = null;

    /**
     * Scriptlet parameters.
     */
    public scriptletParams: ScriptletParams;

    /**
     * If the rule contains scriptlet content.
     */
    public isScriptlet = false;

    /**
     * HTML filtering rule selector list.
     */
    private htmlSelectorList: HtmlSelectorList | null = null;

    /**
     * Gets rule index.
     *
     * @returns Rule index.
     */
    public getIndex(): number {
        return this.ruleIndex;
    }

    /**
     * Gets filter list id.
     *
     * @returns Filter list id.
     */
    public getFilterListId(): number {
        return this.filterListId;
    }

    /**
     * Returns the rule text.
     *
     * @returns Rule text.
     */
    public getText(): string | undefined {
        return this.ruleText;
    }

    /**
     * Returns the rule content.
     *
     * @returns The content of the rule.
     */
    public getContent(): string {
        return this.content;
    }

    /**
     * Cosmetic rule type (always present).
     *
     * @returns The type of the cosmetic rule.
     */
    public getType(): CosmeticRuleType {
        return this.type;
    }

    /**
     * Allowlist means that this rule is meant to disable other rules,
     * i.e. an exception rule.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#elemhide-exceptions}
     *
     * @returns True if the rule is an allowlist rule, false otherwise.
     */
    public isAllowlist(): boolean {
        return this.allowlist;
    }

    /**
     * Returns script ready to execute or null
     * Rebuilds scriptlet script if debug or domain params change.
     *
     * @param options Script options.
     *
     * @returns Script code or null.
     */
    public getScript(options: InitScriptParams = {}): string | null {
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
     *
     * @returns List of permitted domains or null if no domain modifier is set.
     */
    public getPermittedDomains(): string[] | null {
        if (this.domainModifier) {
            return this.domainModifier.getPermittedDomains();
        }
        return null;
    }

    /**
     * Gets list of restricted domains.
     *
     * @returns List of restricted domains or null if no domain modifier is set.
     */
    public getRestrictedDomains(): string[] | null {
        if (this.domainModifier) {
            return this.domainModifier.getRestrictedDomains();
        }
        return null;
    }

    /**
     * Returns HTML filtering rule selector list.
     *
     * @returns HTML filtering rule selector list or `null` if the rule is not an HTML filtering rule.
     */
    public getHtmlSelectorList(): HtmlSelectorList | null {
        return this.htmlSelectorList;
    }

    /**
     * Returns true if the rule is considered "generic"
     * "generic" means that the rule is not restricted to a limited set of domains
     * Please note that it might be forbidden on some domains, though.
     *
     * @returns True if the rule is generic, false otherwise.
     */
    public isGeneric(): boolean {
        return !this.domainModifier?.hasPermittedDomains();
    }

    /**
     * Checks if the rule is ExtendedCss.
     *
     * @returns True if the rule is ExtendedCss, false otherwise.
     */
    public isExtendedCss(): boolean {
        return this.extendedCss;
    }

    /**
     * Processes cosmetic rule modifiers, e.g. `$path`.
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#modifiers-for-non-basic-type-of-rules}
     *
     * @param ruleNode Cosmetic rule node to process.
     *
     * @returns Processed modifiers ({@link ProcessedModifiers}) or `null` if there are no modifiers.
     */
    private static processModifiers(ruleNode: AnyCosmeticRule): ProcessedModifiers | null {
        // Do nothing if there are no modifiers in the rule node
        if (!ruleNode.modifiers) {
            return null;
        }

        const result: ProcessedModifiers = {};

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
     * Processes HTML filtering rule selector list.
     *
     * @param ruleNode Cosmetic rule node to process.
     *
     * @returns Processed {@link HtmlSelectorList} or `null` if the rule is not an HTML filtering rule.
     *
     * @throws Error if the rule body is not parsed into AST nodes.
     * @throws Error if special selector is missing a value.
     * @throws Error if an unsupported simple selector type is encountered.
     */
    private static processHtmlSelectorList(ruleNode: AnyCosmeticRule): HtmlSelectorList | null {
        // Process only HTML filtering rules
        if (ruleNode.type !== CosmeticRuleType.HtmlFilteringRule) {
            return null;
        }

        // Process only parsed HTML filtering rule bodies
        // This can happen if the passed node is not parsed with `parseHtmlFilteringRuleBodies` option enabled
        // which indicates that the rule body is not used for filtering and thus selector list isn't used
        if (ruleNode.body.type !== 'HtmlFilteringRuleBody') {
            return null;
        }

        const result: HtmlSelectorList = {
            selectors: [],
        };

        // Destructure the selectors array just for convenience
        // Note: AGTree do not tolerate empty selector lists,
        // so we can assume that there is at least one selector in the list
        const { children: selectors } = ruleNode.body.selectorList;

        for (const selectorNode of selectors) {
            // Destructure the simple selectors array just for convenience
            // Note: AGTree do not tolerate empty simple selector lists,
            // so we can assume that there is at least one simple selector in the list
            const { children: simpleSelectors } = selectorNode;

            const complexSelectors: HtmlSelector[] = [];

            let previousCombinator: SelectorCombinatorValue | null = null;
            let currentNativeSelector = '';
            let currentSpecialSelectors: HtmlSpecialSelector[] = [];

            for (let i = 0; i < simpleSelectors.length; i += 1) {
                const simpleSelectorNode = simpleSelectors[i];

                const { type } = simpleSelectorNode;
                switch (type) {
                    // tag selectors can be added as-is
                    case 'TypeSelector':
                        currentNativeSelector += simpleSelectorNode.value;
                        break;

                    // id selectors should be prefixed
                    case 'IdSelector':
                        currentNativeSelector += `#${simpleSelectorNode.value}`;
                        break;

                    // class selectors should be prefixed
                    case 'ClassSelector':
                        currentNativeSelector += `.${simpleSelectorNode.value}`;
                        break;

                    // attribute selectors should be wrapped in square brackets and quoted
                    case 'AttributeSelector':
                        currentNativeSelector += `[${simpleSelectorNode.name.value}`;
                        if ('value' in simpleSelectorNode) {
                            currentNativeSelector += simpleSelectorNode.operator.value;

                            // It's safe to set double quotes here, as AGTree removes any existing quotes
                            // from the attribute value and unescapes it, so we just need to quote it properly
                            // again and escape any double quotes in the value
                            currentNativeSelector += QuoteUtils.setStringQuoteType(
                                simpleSelectorNode.value.value,
                                QuoteType.Double,
                            );

                            if (simpleSelectorNode.flag) {
                                currentNativeSelector += ` ${simpleSelectorNode.flag.value}`;
                            }
                        }
                        currentNativeSelector += ']';

                        break;

                    // if it's a pseudo-class selector, we need to check if it's a special one
                    // if yes, we add it to the special selectors list, otherwise we add it to the native selector
                    case 'PseudoClassSelector':
                        if (simpleSelectorNode.name.value === HtmlSpecialSelectorName.Contains) {
                            if (!simpleSelectorNode.argument) {
                                throw new Error(
                                    `'${HtmlSpecialSelectorName.Contains}' pseudo-class requires an argument`,
                                );
                            }

                            currentSpecialSelectors.push({
                                name: HtmlSpecialSelectorName.Contains,
                                value: SimpleRegex.fromLiteral(simpleSelectorNode.argument.value),
                            });
                        } else {
                            currentNativeSelector += `:${simpleSelectorNode.name.value}`;
                            if (simpleSelectorNode.argument) {
                                currentNativeSelector += `(${simpleSelectorNode.argument.value})`;
                            }
                        }
                        break;

                    // This case is handled after the switch
                    case 'SelectorCombinator':
                        break;

                    default:
                        throw new Error(`Unsupported simple selector type: '${type}'`);
                }

                // If it's a combinator or the last simple selector, we should finalize the current compound selector
                if (type === 'SelectorCombinator' || i === simpleSelectors.length - 1) {
                    const selector: HtmlSelector = {
                        nativeSelector: currentNativeSelector,
                        specialSelectors: currentSpecialSelectors,
                    };

                    if (previousCombinator) {
                        selector.combinator = previousCombinator;
                    }

                    complexSelectors.push(selector);

                    // Reset current compound selector state for the next one if it was a combinator
                    if (type === 'SelectorCombinator') {
                        previousCombinator = simpleSelectorNode.value;
                        currentNativeSelector = '';
                        currentSpecialSelectors = [];
                    }
                }
            }

            result.selectors.push(complexSelectors);
        }

        return result;
    }

    /**
     * Validates cosmetic rule node.
     *
     * @param ruleNode Cosmetic rule node to validate.
     *
     * @returns Validation result {@link ValidationResult}.
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
                    // Skip validation for regex domain patterns
                    if (
                        !RegExpUtils.isRegexPattern(domain)
                        && !DomainUtils.isValidDomainOrHostname(domain)
                    ) {
                        throw new Error(`'${domain}' is not a valid domain name or regexp pattern`);
                    }
                }
            }

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
                    // eslint-disable-next-line max-len
                    scriptletName = QuoteUtils.removeQuotes(ruleNode.body.children[0]?.children[0]?.value ?? EMPTY_STRING);

                    // Special case: scriptlet name is empty, e.g. '#%#//scriptlet()'
                    if (scriptletName.length === 0) {
                        break;
                    }

                    // Check if the scriptlet name is valid
                    if (!isValidScriptletName(scriptletName)) {
                        throw new Error(`'${scriptletName}' is not a known scriptlet name`);
                    }
                    break;

                case CosmeticRuleType.HtmlFilteringRule:
                    // AGTree won't allow invalid selector lists (both in parser and converter)
                    // thus we don't need to validate them here
                    break;

                case CosmeticRuleType.JsInjectionRule:
                    // TODO: Validate JS injection rules
                    break;

                default:
                    break;
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
     * @param domainListNode Domain list node to check.
     *
     * @returns `true` if the domain list contains any domains, `false` otherwise.
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
     * @param ruleText Rule text.
     * @param filterListId ID of the filter list this rule belongs to.
     * @param ruleIndex Line start index in the source filter list; it will be used to find the original rule text
     * in the filtering log when a rule is applied. Default value is {@link RULE_INDEX_NONE} which means that
     * the rule does not have source index.
     * @param node Optional pre-parsed cosmetic rule node to avoid re-parsing.
     *
     * @throws Error if it fails to parse the rule or if the rule is not a cosmetic rule.
     */
    constructor(
        ruleText: string,
        filterListId: number = FILTER_LIST_ID_NONE,
        ruleIndex: number = RULE_INDEX_NONE,
        node?: AnyCosmeticRule,
    ) {
        this.ruleIndex = ruleIndex;
        this.filterListId = filterListId;

        // Store rule text in the instance if the rule is not indexed in FiltersStorage.
        // When filterListId or ruleIndex is NONE, the rule text cannot be retrieved
        // from the engine and must be available via getText().
        if (filterListId === FILTER_LIST_ID_NONE || ruleIndex === RULE_INDEX_NONE) {
            this.ruleText = ruleText;
        }

        // Use provided node or parse the rule text
        let parsedNode: AnyCosmeticRule;
        if (node) {
            parsedNode = node;
        } else {
            const parsed = CosmeticRuleParser.parse(ruleText, CosmeticRule.PARSER_OPTIONS);

            // CosmeticRuleParser returns null if the rule is not a valid cosmetic rule
            if (!parsed) {
                throw new SyntaxError(`Failed to parse as cosmetic rule: ${ruleText}`);
            }

            parsedNode = parsed;
        }

        this.allowlist = CosmeticRuleSeparatorUtils.isException(parsedNode.separator.value as CosmeticRuleSeparator);
        this.type = parsedNode.type;
        this.isScriptlet = parsedNode.type === CosmeticRuleType.ScriptletInjectionRule;

        this.content = CosmeticRuleBodyGenerator.generate(parsedNode);

        // Store the scriptlet parameters. They will be used later, when we initialize the scriptlet,
        // but at this point we need to store them in order to avoid double parsing
        if (parsedNode.type === CosmeticRuleType.ScriptletInjectionRule) {
            // Transform complex node into a simple array of strings
            const params = parsedNode.body.children[0]?.children.map(
                (param) => (param === null ? EMPTY_STRING : QuoteUtils.removeQuotesAndUnescape(param.value)),
            ) ?? [];

            this.scriptletParams = new ScriptletParams(params[0] ?? '', params.slice(1));
        } else {
            this.scriptletParams = new ScriptletParams();
        }

        const validationResult = CosmeticRule.validate(parsedNode);

        // We should throw an error if the validation failed for any reason
        if (!validationResult.isValid) {
            throw new SyntaxError(validationResult.errorMessage);
        }

        // Check if the rule is ExtendedCss
        const isExtendedCssSeparator = CosmeticRuleSeparatorUtils.isExtendedCssMarker(
            parsedNode.separator.value as CosmeticRuleSeparator,
        );

        this.extendedCss = isExtendedCssSeparator || validationResult.isExtendedCss;

        // Process cosmetic rule modifiers
        const processedModifiers = CosmeticRule.processModifiers(parsedNode);

        if (processedModifiers) {
            if (processedModifiers.domainModifier) {
                this.domainModifier = processedModifiers.domainModifier;
            }

            if (processedModifiers.pathModifier) {
                this.pathModifier = processedModifiers.pathModifier;
            }

            if (processedModifiers.urlModifier) {
                this.urlModifier = processedModifiers.urlModifier;
            }
        }

        // Process domain list, if at least one domain is specified
        const { domains: domainListNode } = parsedNode;

        if (CosmeticRule.isAnyDomainSpecified(domainListNode)) {
            this.domainModifier = new DomainModifier(domainListNode, COMMA_DOMAIN_LIST_SEPARATOR);
        }

        // Process HTML filtering rule selector list
        this.htmlSelectorList = CosmeticRule.processHtmlSelectorList(parsedNode);
    }

    /**
     * Match returns true if this rule can be used on the specified request.
     *
     * @param request Request to check.
     *
     * @returns True if the rule matches the request, false otherwise.
     */
    public match(request: Request): boolean {
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
     *
     * @returns The scriptlet data or null if not available.
     */
    public getScriptletData(): ScriptletData | null {
        if (this.scriptletData) {
            return this.scriptletData;
        }

        this.initScript();

        return this.scriptletData;
    }

    /**
     * Updates this.scriptData and this.scriptletData when it is necessary in a lazy way.
     *
     * @param options Initialization options for the script.
     */
    public initScript(options: InitScriptParams = {}) {
        const { debug = false, frameUrl } = options;
        const ruleContent = this.getContent();
        if (!this.isScriptlet) {
            this.scriptData = {
                code: ruleContent,
            };
            return;
        }

        // A scriptlet without a name can only be an allowlist scriptlet
        // https://github.com/AdguardTeam/Scriptlets/issues/377
        // or it is considered invalid if the scriptlet was invalid.
        // This does not require finding scriptData and scriptletData.
        if (!this.scriptletParams?.name) {
            return;
        }

        const params: Source = {
            args: this.scriptletParams.args,
            engine: config.engine || EMPTY_STRING,
            name: this.scriptletParams.name,
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
