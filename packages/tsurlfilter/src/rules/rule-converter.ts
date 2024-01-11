import scriptlets from '@adguard/scriptlets';

import { logger } from '../utils/logger';
import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { SimpleRegex } from './simple-regex';
import { OPTIONS_DELIMITER } from './network-rule-options';
import { parseOptionsString } from '../utils/parse-options-string';
import { RuleFactory } from './rule-factory';
import { SUPPORTED_EXT_CSS_ATTRIBUTE_SELECTORS, SUPPORTED_EXT_CSS_PSEUDO_CLASSES } from './css/known-elements';

const EXT_CSS_PSEUDO_INDICATORS = [
    ...Array.from(SUPPORTED_EXT_CSS_PSEUDO_CLASSES, (x) => `:${x}(`),
    ...Array.from(SUPPORTED_EXT_CSS_ATTRIBUTE_SELECTORS, (x) => `[${x}=`),
];

/**
 * Rule converter class
 */
export class RuleConverter {
    private static CSS_RULE_REPLACE_PATTERN = /(.*):style\((.*)\)/g;

    // eslint-disable-next-line max-len
    private static SCRIPT_HAS_TEXT_REGEX = /##\^(script(\[[{a-z0-9-_.:}]*(="[{a-z0-9-_.:}]*")*\])*:(has-text|contains))\((?!\/.+\/\))/i;

    private static SCRIPT_HAS_TEXT_REGEX_SHORT = /(##\^script:(has-text|contains))\((?!\/.+\/\))/i;

    private static TAG_CONTENT_VALUE_REGEX = /\[tag-content="(.*?)"]/g;

    private static ATTRIBUTE_REGEX = /(\[[{a-z0-9-_.:}]*(="[{a-z0-9-_.:}]*")*\])/i;

    private static CSS_COMBINATORS_REGEX = />|\+|~/;

    private static SCRIPT_HAS_TEXT_REPLACEMENT = '$$$$script[tag-content="';

    private static UBO_RESPONSE_HEADER = '#^responseheader(';

    private static UBO_RESPONSE_HEADER_REGEX = /##\^responseheader\((?!\/.+\/\))/i;

    private static UBO_RESPONSE_HEADER_EXCEPTION_REGEX = /#@#\^responseheader\((?!\/.+\/\))/i;

    private static UBO_RESPONSE_HEADER_REPLACEMENT = '^$removeheader=';

    private static UBO_MATCHES_PATH = ':matches-path(';

    private static UBO_REVERSED_MATCHES_PATH = ':not(:matches-path(';

    /**
     * Rule masks
     */
    private static MASK_ELEMENT_HIDING = '##';

    private static UBO_HTML_RULE_MASK = '##^';

    private static MASK_ELEMENT_HIDING_EXCEPTION = '#@#';

    private static MASK_CSS = '#$#';

    private static MASK_CSS_EXCEPTION = '#@$#';

    private static MASK_CSS_EXTENDED_CSS_RULE = '#?#';

    private static MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE = '#@?#';

    private static MASK_CSS_INJECT_EXTENDED_CSS_RULE = '#$?#';

    private static MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE = '#@$?#';

    private static REMOVE_RULE_PATTERN = ':remove()';

    private static REMOVE_RULE_REPLACER = ' { remove: true; }';

    /**
     * Special characters
     */
    private static REGEXP_DELIMITER = '/';

    private static ESCAPING_SLASH = '\\';

    /**
     * Converts rules text
     *
     * @param rulesText
     */
    public static convertRules(rulesText: string): string {
        const result = [];

        const lines = rulesText.split(/\r?\n/);
        for (const line of lines) {
            try {
                result.push(...RuleConverter.convertRule(line));
            } catch (e) {
                logger.warn((e as Error).message);
            }
        }

        return result.join('\n');
    }

    /**
     * Splits the given rule text into domain and options parts using the options delimiter ($).
     * Returns the domain part and an array of options, or null if no options are present.
     *
     * @param ruleText - The rule text to be split.
     * @returns [domain, options] or [domain, null] if no options are present.
     */
    private static splitIntoDomainAndOptions = (ruleText: string): [string, string[] | null] => {
        let optionsDelimiterIdx = -1;
        let inRegExp = false;
        for (let i = ruleText.length - 1; i >= 0; i -= 1) {
            if (!inRegExp && ruleText[i] === OPTIONS_DELIMITER) {
                optionsDelimiterIdx = i;
                break;
            }
            if (
                ruleText[i] === this.REGEXP_DELIMITER
                && (i === 0 || ruleText[i - 1] !== this.ESCAPING_SLASH)
            ) {
                inRegExp = !inRegExp;
            }
        }
        if (optionsDelimiterIdx === -1) {
            return [ruleText, null];
        }
        const domainPart = ruleText.slice(0, optionsDelimiterIdx);
        const optionsPart = ruleText.slice(optionsDelimiterIdx + 1);
        // do not remove escape characters from regexp modifiers values
        const optionsParts = parseOptionsString(optionsPart, false);

        return [domainPart, optionsParts];
    };

    /**
     * TODO for more efficient conversion build AST. And then use the modified AST for creating a
     *  rule object.
     * Convert external scriptlet rule to AdGuard scriptlet syntax
     *
     * @param rawRule
     */
    public static convertRule(rawRule: string): string[] {
        const rule = rawRule.trim();
        if (rule.startsWith(SimpleRegex.MASK_COMMENT) || rule === '') {
            return [rule];
        }

        const comment = RuleConverter.convertUboComments(rule);
        if (comment) {
            return [comment];
        }

        let converted = rule;
        if (RuleFactory.isCosmetic(rule)) {
            converted = RuleConverter.convertCssInjection(converted);
            converted = RuleConverter.convertPseudoElements(converted);
            converted = RuleConverter.convertRemoveRule(converted);
            converted = RuleConverter.convertScriptHasTextToScriptTagContent(converted);
            converted = RuleConverter.convertUboMatchesPathRule(converted);

            // special case for ubo response header rule, it looks like cosmetic rule, but is converted to network rule
            const removeHeaderRule = RuleConverter.convertUboResponseHeaderRule(converted);
            if (removeHeaderRule) {
                return [removeHeaderRule];
            }
        } else {
            const domainAndOptions = RuleConverter.splitIntoDomainAndOptions(converted);
            const domain = domainAndOptions[0];
            let optionsParts = domainAndOptions[1];
            if (optionsParts) {
                optionsParts = RuleConverter.replaceOptions(optionsParts);
                const ruleWithConvertedOptions = RuleConverter.convertOptions(
                    domain,
                    optionsParts,
                );
                if (ruleWithConvertedOptions) {
                    return ruleWithConvertedOptions;
                }
                converted = `${domain}$${optionsParts.join(',')}`;
            }
        }

        const scriptletRules = scriptlets.convertScriptletToAdg(converted);
        // TODO Check if isValidScriptletRule call is needed here, looks like convertScriptletToAdg
        //  should already return a valid scriptlet.
        if (scriptletRules && scriptletRules.every((x) => RuleConverter.isValidScriptletRule(x))) {
            return scriptletRules;
        }

        const adgRedirectRule = RuleConverter.convertUboAndAbpRedirectsToAdg(converted);
        if (adgRedirectRule) {
            return [adgRedirectRule];
        }

        if (converted.includes(RuleConverter.UBO_HTML_RULE_MASK)) {
            throw new SyntaxError(`Invalid UBO script rule: ${converted}`);
        }

        return [converted];
    }

    /**
     * Validates AdGuard syntax scriptlet rule.
     *
     * @param ruleText AdGuard scriptlet rule.
     */
    private static isValidScriptletRule(ruleText: string): boolean {
        try {
            // checks whether the ADG scriptlet rule name is valid
            return scriptlets.isValidScriptletRule(ruleText);
        } catch (e) {
            return false;
        }
    }

    /**
     * Converts UBO Script rule
     *
     * @param {string} ruleText rule text
     * @returns {string} converted rule
     */
    private static convertScriptHasTextToScriptTagContent(ruleText: string): string {
        if (ruleText.startsWith(SimpleRegex.MASK_COMMENT)
            || !RuleConverter.SCRIPT_HAS_TEXT_REGEX.test(ruleText)
            || RuleConverter.CSS_COMBINATORS_REGEX.test(ruleText)) {
            return ruleText;
        }

        let convertedRuleText = ruleText;
        let attributeStrings: string[] | null = [];

        // Cut all attributes substrings from rule text into array
        // https://github.com/AdguardTeam/tsurlfilter/issues/55
        if (RuleConverter.ATTRIBUTE_REGEX.test(ruleText)) {
            const globalAttributeRegExp = new RegExp(RuleConverter.ATTRIBUTE_REGEX, 'gi');
            attributeStrings = ruleText.match(globalAttributeRegExp);
            attributeStrings?.forEach((attrStr) => {
                convertedRuleText = convertedRuleText.replace(attrStr, '');
            });
        }

        // Convert base of the rule ##^script:has-text(text) to $$script[tag-content='text']
        convertedRuleText = `${
            convertedRuleText
                .replace(RuleConverter.SCRIPT_HAS_TEXT_REGEX_SHORT, RuleConverter.SCRIPT_HAS_TEXT_REPLACEMENT)
                .slice(0, -1)
        }"][max-length="262144"]`;

        // Escape double quotes inside tag-content, like it is required by AdGuard syntax
        // https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content
        convertedRuleText = convertedRuleText.replace(RuleConverter.TAG_CONTENT_VALUE_REGEX, (match, group) => {
            return `[tag-content="${group.replace(/"/g, '""')}"]`;
        });

        // Return attributes if there were any
        attributeStrings?.forEach((attrStr) => {
            convertedRuleText += attrStr;
        });

        return convertedRuleText;
    }

    /**
     * Converts UBO and ABP redirect rules to AdGuard redirect rules
     * @param rule
     * @return {string} convertedRule
     */
    private static convertUboAndAbpRedirectsToAdg(rule: string): string | null {
        const { redirects } = scriptlets;
        if (redirects.isUboRedirectCompatibleWithAdg(rule) || redirects.isAbpRedirectCompatibleWithAdg(rule)) {
            return redirects.convertRedirectToAdg(rule);
        }

        return null;
    }

    /**
     * These option shortcuts will be converted to a more wordy AdGuard options.
     * @private
     */
    private static OPTIONS_CONVERSION_MAP = new Map<string, string>([
        // See https://adguard.com/kb/general/ad-filtering/create-own-filters/#empty-modifier
        ['empty', 'redirect=nooptext'],
        // See https://adguard.com/kb/general/ad-filtering/create-own-filters/#mp4-modifier
        ['mp4', 'redirect=noopmp4-1s'],
        ['inline-script', "csp=script-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:"],
        ['inline-font', "csp=font-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:"],
    ]);

    /**
     * Converts the rule options according to the conversion map and handles special cases.
     * @param domainPart - The domain part of the rule.
     * @param optionsParts - The options part of the rule as an array of strings.
     * @private
     */
    private static convertOptions(
        domainPart: string,
        optionsParts: string[],
    ): string[] | null {
        const NAME_VALUE_SPLITTER = '=';

        let areOptionsConverted = false;

        let updatedOptionsParts = optionsParts.map((optionsPart) => {
            let convertedOptionsPart = RuleConverter.OPTIONS_CONVERSION_MAP.get(optionsPart);

            // If option is $mp4, then it should go with $media option together
            if (optionsPart === 'mp4') {
                // Check if media is not already among options
                if (!optionsParts.some((option) => option === 'media')) {
                    convertedOptionsPart = `${convertedOptionsPart},media`;
                }
            }

            if (convertedOptionsPart) {
                areOptionsConverted = true;
                return convertedOptionsPart;
            }

            return optionsPart;
        });

        // If options have more than one csp modifiers, we merge them into one;
        const cspParts = updatedOptionsParts.filter((optionsPart) => optionsPart.startsWith('csp'));
        if (cspParts.length > 1) {
            const allButCsp = updatedOptionsParts.filter((optionsPart) => !optionsPart.startsWith('csp'));
            const cspValues = cspParts.map((cspPart) => cspPart.split(NAME_VALUE_SPLITTER)[1]);

            const updatedCspOption = `csp${NAME_VALUE_SPLITTER}${cspValues.join('; ')}`;
            updatedOptionsParts = allButCsp.concat(updatedCspOption);
        }

        if (areOptionsConverted) {
            const updatedOptions = updatedOptionsParts.join(',');
            return [`${domainPart}$${updatedOptions}`];
        }

        return null;
    }

    /**
     * Converts ubo syntax comments (rules starting with #)
     * Note: It's not possible to detect 100% cause rules starting with ## are valid elemhide rules
     *
     * @param rule
     * @return {string}
     */
    private static convertUboComments(rule: string): string | null {
        if (rule.startsWith('# ') || rule.startsWith('####')) {
            return `! ${rule}`;
        }

        return null;
    }

    /**
     * Executes rule css conversion
     *
     * @param rule
     * @param parts
     * @param ruleMark
     */
    private static executeConversion(rule: string, parts: string[], ruleMark: string): string {
        let result = rule;
        const domain = parts[0];

        if (domain) {
            const rulePart = parts[1];
            if (rulePart.match(RuleConverter.CSS_RULE_REPLACE_PATTERN)) {
                const groups = RuleConverter.CSS_RULE_REPLACE_PATTERN.exec(rulePart);
                if (groups != null) {
                    if (groups.length === 3) {
                        result = domain + ruleMark;
                        result += `${groups[1]} { ${groups[2]} }`;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Adds colon to the pseudo elements written with one colon (:before, :after);
     * e.g.
     *  "hotline.ua##.reset-scroll:before" -> "hotline.ua##.reset-scroll::before"
     * @param rule
     * @private
     */
    private static convertPseudoElements(rule: string): string {
        const BEFORE = 'before';
        const AFTER = 'after';
        const SINGLE_COLON = ':';

        // does not have parts to convert
        if (!(rule.includes(SINGLE_COLON + BEFORE) || rule.includes(SINGLE_COLON + AFTER))) {
            return rule;
        }

        // not an css rule
        if (!(rule.includes(RuleConverter.MASK_ELEMENT_HIDING)
            || rule.includes(RuleConverter.MASK_ELEMENT_HIDING_EXCEPTION)
            || rule.includes(RuleConverter.MASK_CSS)
            || rule.includes(RuleConverter.MASK_CSS_EXCEPTION))) {
            return rule;
        }

        let modifiedRule = '';

        for (let i = 0; i < rule.length; i += 1) {
            if (rule[i] !== SINGLE_COLON) {
                modifiedRule += rule[i];
                continue;
            }

            if ((rule.indexOf(BEFORE, i) === i + 1
                    || rule.indexOf(AFTER, i) === i + 1)
                && rule[i - 1] !== SINGLE_COLON) {
                modifiedRule += SINGLE_COLON;
                modifiedRule += rule[i];
                continue;
            }

            modifiedRule += rule[i];
        }

        return modifiedRule;
    }

    /**
     * Converts CSS injection
     * example.com##h1:style(background-color: blue !important)
     * into
     * example.com#$#h1 { background-color: blue !important }
     * <p>
     * OR (for exceptions):
     * example.com#@#h1:style(background-color: blue !important)
     * into
     * example.com#@$#h1 { background-color: blue !important }
     *
     * @param {string} rule
     * @return {string} convertedRule
     */
    private static convertCssInjection(rule: string): string {
        if (rule.includes(':style')) {
            let parts;
            let resultMask;
            let resultRule = rule;
            let isExtendedCss = false;
            for (let i = 0; i < EXT_CSS_PSEUDO_INDICATORS.length; i += 1) {
                isExtendedCss = rule.indexOf(EXT_CSS_PSEUDO_INDICATORS[i]) !== -1;
                if (isExtendedCss) {
                    break;
                }
            }

            if (rule.includes(RuleConverter.MASK_CSS_EXTENDED_CSS_RULE)) {
                parts = rule.split(RuleConverter.MASK_CSS_EXTENDED_CSS_RULE, 2);
                resultMask = RuleConverter.MASK_CSS_INJECT_EXTENDED_CSS_RULE;
            } else if (rule.includes(RuleConverter.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE)) {
                parts = rule.split(RuleConverter.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE, 2);
                resultMask = RuleConverter.MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE;
                // firstly we check for exception rule in order not to confuse with id selectors
                // e.g. yourconroenews.com#@##siteNav:style(transform: none !important;)
            } else if (rule.includes(RuleConverter.MASK_ELEMENT_HIDING_EXCEPTION)) {
                parts = rule.split(RuleConverter.MASK_ELEMENT_HIDING_EXCEPTION, 2);
                if (isExtendedCss) {
                    resultMask = RuleConverter.MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE;
                } else {
                    resultMask = RuleConverter.MASK_CSS_EXCEPTION;
                }
            } else if (rule.includes(RuleConverter.MASK_ELEMENT_HIDING)) {
                parts = rule.split(RuleConverter.MASK_ELEMENT_HIDING, 2);
                if (isExtendedCss) {
                    resultMask = RuleConverter.MASK_CSS_INJECT_EXTENDED_CSS_RULE;
                } else {
                    resultMask = RuleConverter.MASK_CSS;
                }
            }

            if (parts && resultMask) {
                resultRule = RuleConverter.executeConversion(rule, parts, resultMask);
            }

            return resultRule;
        }

        return rule;
    }

    /**
     * Converts ':remove()' rule to AdGuard extended css rule
     * example.com###banner:remove() -> example.com#$?##banner { remove: true; }
     * @param {string} rule
     * @return {string} rule or converted rule
     */
    private static convertRemoveRule(rule: string): string {
        // if rule is already extended css, do not convert it
        if (rule.includes(RuleConverter.MASK_CSS_EXTENDED_CSS_RULE)) {
            return rule;
        }

        if (rule.includes(RuleConverter.MASK_ELEMENT_HIDING) && rule.endsWith(RuleConverter.REMOVE_RULE_PATTERN)) {
            return rule
                .replace(RuleConverter.MASK_ELEMENT_HIDING, RuleConverter.MASK_CSS_INJECT_EXTENDED_CSS_RULE)
                .replace(RuleConverter.REMOVE_RULE_PATTERN, RuleConverter.REMOVE_RULE_REPLACER);
        }

        return rule;
    }

    /**
     * Converts '^responseheader()' rule to AdGuard's $removeheader modifier
     * "ya.ru##^responseheader(header-name)" -> "||ya.ru^$removeheader=header-name"
     *
     * @param {string} ruleText
     * @return {string} ruleText or converted rule
     */
    private static convertUboResponseHeaderRule(ruleText: string): string | null {
        if (ruleText.startsWith(SimpleRegex.MASK_COMMENT) || !ruleText.includes(RuleConverter.UBO_RESPONSE_HEADER)) {
            return null;
        }

        if (RuleConverter.UBO_RESPONSE_HEADER_REGEX.test(ruleText)) {
            return `||${
                ruleText.replace(RuleConverter.UBO_RESPONSE_HEADER_REGEX, RuleConverter.UBO_RESPONSE_HEADER_REPLACEMENT)
                    .slice(0, -1)
            }`;
        }

        if (RuleConverter.UBO_RESPONSE_HEADER_EXCEPTION_REGEX.test(ruleText)) {
            return `@@||${
                ruleText.replace(
                    RuleConverter.UBO_RESPONSE_HEADER_EXCEPTION_REGEX,
                    RuleConverter.UBO_RESPONSE_HEADER_REPLACEMENT,
                ).slice(0, -1)
            }`;
        }

        return ruleText;
    }

    /**
     * Converts cosmetic 'matches-path()' rule to AdGuard's $path modifier
     * "ya.ru##:matches-path(/page) p" -> "[$path=/page]ya.ru##p"
     *
     * @param {string} ruleText
     * @return {string} ruleText or converted rule
     */
    private static convertUboMatchesPathRule(ruleText: string): string {
        if (ruleText.startsWith(SimpleRegex.MASK_COMMENT)) {
            return ruleText;
        }

        const [markerIndex, marker] = findCosmeticRuleMarker(ruleText);

        if (!marker) {
            return ruleText;
        }

        const expressionStartIndex = markerIndex + marker.length;

        const matchesPathStartIndex = ruleText.indexOf(RuleConverter.UBO_MATCHES_PATH, expressionStartIndex);

        if (matchesPathStartIndex === -1) {
            return ruleText;
        }

        const reversedMatchesPathStartIndex = ruleText.indexOf(
            RuleConverter.UBO_REVERSED_MATCHES_PATH,
            expressionStartIndex,
        );

        const isReversed = reversedMatchesPathStartIndex !== -1;

        const pathStartIndex = isReversed
            ? reversedMatchesPathStartIndex + RuleConverter.UBO_REVERSED_MATCHES_PATH.length
            : matchesPathStartIndex + RuleConverter.UBO_MATCHES_PATH.length;

        let matchPathOperatorCloseBracketIndex;

        let openBracketCounter = 1;
        let closeBracketCounter = 0;

        for (let i = pathStartIndex; i < ruleText.length; i += 1) {
            if (ruleText[i - 1] !== '\\') {
                if (ruleText[i] === '(') {
                    openBracketCounter += 1;
                } else if (ruleText[i] === ')') {
                    closeBracketCounter += 1;
                    if (openBracketCounter === closeBracketCounter) {
                        matchPathOperatorCloseBracketIndex = i;
                        break;
                    }
                }
            }
        }

        if (!matchPathOperatorCloseBracketIndex) {
            return ruleText;
        }

        const domains = ruleText.slice(0, markerIndex);

        const expressionMiddle = ruleText.slice(
            expressionStartIndex,
            isReversed ? reversedMatchesPathStartIndex : matchesPathStartIndex,
        );

        const expressionTail = ruleText
            .slice(matchPathOperatorCloseBracketIndex + (isReversed ? 2 : 1))
            .trim();

        let path = ruleText.slice(pathStartIndex, matchPathOperatorCloseBracketIndex);

        const isRegex = SimpleRegex.isRegexPattern(path);

        if (isReversed) {
            path = `/^((?!${isRegex ? path.slice(1, path.length - 1) : SimpleRegex.patternToRegexp(path)}).)*$/`;
        }

        if (isRegex) {
            path = SimpleRegex.escapeRegexSpecials(path, SimpleRegex.reModifierPatternSpecialCharacters);
        }

        return `[$path=${path}]${domains}${marker}${expressionMiddle}${expressionTail}`;
    }

    /**
     * Options aliases, used to convert non-AdGuard options to AdGuard options
     */
    private static OPTIONS_ALIASES: { [key: string]: string } = {
        'first-party': '~third-party',
        xhr: 'xmlhttprequest',
        css: 'stylesheet',
        frame: 'subdocument',
        queryprune: 'removeparam',
        doc: 'document',
        '1p': '~third-party',
        '3p': 'third-party',
        ghide: 'generichide',
        ehide: 'elemhide',
        shide: 'specifichide',
    };

    /**
     * Substitutes option aliases in the provided options array with their corresponding aliases.
     *
     * @param optionsParts - An array of options to replace aliases in.
     * @returns - An array of options with aliases replaced.
     */
    private static replaceOptions(optionsParts: string[]): string[] {
        const resultOptions = optionsParts.map((option) => {
            const [optionNameRaw, optionValue] = option.split('=', 2);
            const isNegated = optionNameRaw.startsWith('~');
            const optionName = isNegated ? optionNameRaw.slice(1) : optionNameRaw;
            const convertedOptionName = RuleConverter.OPTIONS_ALIASES[optionName];
            if (!convertedOptionName) {
                return option;
            }
            const negationPrefix = isNegated ? '~' : '';
            return optionValue
                ? `${negationPrefix}${convertedOptionName}=${optionValue}`
                : `${negationPrefix}${convertedOptionName}`;
        });
        return resultOptions;
    }
}
