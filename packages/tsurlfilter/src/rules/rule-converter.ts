import scriptlets from '@adguard/scriptlets';
import { logger } from '../utils/logger';
import { EXT_CSS_PSEUDO_INDICATORS } from './cosmetic-rule';
import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { RuleFactory } from './rule-factory';
import { SimpleRegex } from './simple-regex';

interface ConversionOptions {
    /**
     * If converter should convert rules with all modifier
     */
    ignoreAllModifier?: boolean;
}

/**
 * Rule converter class
 */
export class RuleConverter {
    private static CSS_RULE_REPLACE_PATTERN = /(.*):style\((.*)\)/g;

    private static FIRST_PARTY_REGEX = /([$,])first-party/i;

    private static FIRST_PARTY_REPLACEMENT = '$1~third-party';

    private static XHR_REGEX = /([$,]~?)xhr/i;

    private static XHR_REPLACEMENT = '$1xmlhttprequest';

    private static CSS_REGEX = /([$,]~?)(css)(,|\W|$)/i;

    private static CSS_REPLACEMENT = '$1stylesheet$3';

    private static FRAME_REGEX = /([$,])frame/i;

    private static FRAME_REPLACEMENT = '$1subdocument';

    private static SCRIPT_HAS_TEXT_REGEX = /(##\^script:(has-text|contains))\((?!\/.+\/\))/i;

    private static SCRIPT_HAS_TEXT_REPLACEMENT = '$$$$script[tag-content="';

    private static THIRD_PARTY_1P_3P_REGEX = /([$,])(1p|3p)/;

    private static THIRD_PARTY_1P_REPLACEMENT = '$1~third-party';

    private static THIRD_PARTY_3P_REPLACEMENT = '$1third-party';

    private static GHIDE_REGEX = /(.+[^#]\$.*)(ghide)($|,.+)/i;

    private static GENERICHIDE = 'generichide';

    private static SHIDE_REGEX = /(.+[^#]\$.*)(shide)($|,.+)/i;

    private static SPECIFICHIDE = 'specifichide';

    private static EHIDE_REGEX = /(.+[^#]\$.*)(ehide)($|,.+)/i;

    private static ELEMHIDE = 'elemhide';

    private static QUERY_PRUNE_REGEX = /(.+[^#]\$.*)(queryprune)($|,|=.+)/i;

    private static REMOVE_PARAM_REPLACEMENT = '$1removeparam$3';

    private static DOC_REGEX = /(.+[^#]\$.*)(doc)($|,.+)/i;

    private static DOC_REPLACEMENT = '$1document$3';

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
     * Converts rules text
     *
     * @param rulesText
     * @param conversionOptions
     */
    public static convertRules(rulesText: string, conversionOptions = {} as ConversionOptions): string {
        const result = [];

        const lines = rulesText.split(/\r?\n/);
        for (const line of lines) {
            try {
                result.push(...RuleConverter.convertRule(line, conversionOptions));
            } catch (e) {
                logger.warn((e as Error).message);
            }
        }

        return result.join('\n');
    }

    /**
     * Convert external scriptlet rule to AdGuard scriptlet syntax
     *
     * @param rule
     * @param conversionOptions
     */
    public static convertRule(rule: string, conversionOptions = {} as ConversionOptions): string[] {
        if (rule.startsWith(SimpleRegex.MASK_COMMENT)
            || rule.trim() === '') {
            return [rule.trim()];
        }

        const comment = RuleConverter.convertUboComments(rule);
        if (comment) {
            return [comment];
        }

        let converted = RuleConverter.convertCssInjection(rule);
        converted = RuleConverter.convertPseudoElements(converted);
        converted = RuleConverter.convertRemoveRule(converted);
        converted = RuleConverter.replaceOptions(converted);
        converted = RuleConverter.convertScriptHasTextToScriptTagContent(converted);
        converted = RuleConverter.convertUboMatchesPathRule(converted);

        const removeHeaderRule = RuleConverter.convertUboResponseHeaderRule(converted);
        if (removeHeaderRule) {
            return [removeHeaderRule];
        }

        const scriptletRules = scriptlets.convertScriptletToAdg(converted);
        if (scriptletRules && scriptletRules.every((x) => RuleConverter.isValidScriptletRule(x))) {
            return scriptletRules;
        }

        const adgRedirectRule = RuleConverter.convertUboAndAbpRedirectsToAdg(converted);
        if (adgRedirectRule) {
            return [adgRedirectRule];
        }

        const ruleWithConvertedOptions = RuleConverter.convertOptions(converted, conversionOptions);
        if (ruleWithConvertedOptions) {
            return ruleWithConvertedOptions;
        }

        return [converted];
    }

    /**
     * Validates scriptlet rule
     *
     * @param ruleText
     */
    private static isValidScriptletRule(ruleText: string): boolean {
        try {
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
        if (!ruleText.startsWith(SimpleRegex.MASK_COMMENT) && RuleConverter.SCRIPT_HAS_TEXT_REGEX.test(ruleText)) {
            return `${
                ruleText.replace(RuleConverter.SCRIPT_HAS_TEXT_REGEX, RuleConverter.SCRIPT_HAS_TEXT_REPLACEMENT)
                    .slice(0, -1)
            }"][max-length="262144"]`;
        }

        return ruleText;
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
     * Converts rule options
     * @param rule
     * @param conversionOptions
     * @private
     */
    private static convertOptions(rule: string, conversionOptions = {} as ConversionOptions): string[] | null {
        const OPTIONS_DELIMITER = '$';
        const ESCAPE_CHARACTER = '\\';
        const NAME_VALUE_SPLITTER = '=';

        /* eslint-disable max-len */
        const conversionMap = new Map<string, string>([
            ['empty', 'redirect=nooptext'],
            ['mp4', 'redirect=noopmp4-1s'],
            ['inline-script', 'csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
            ['inline-font', 'csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
        ]);
        /* eslint-enable max-len */

        let options;
        let domainPart = '';

        // Start looking from the prev to the last symbol
        // If dollar sign is the last symbol - we simply ignore it.
        for (let i = (rule.length - 2); i >= 0; i -= 1) {
            const currChar = rule.charAt(i);
            if (currChar !== OPTIONS_DELIMITER) {
                continue;
            }

            if (i > 0 && rule.charAt(i - 1) !== ESCAPE_CHARACTER) {
                domainPart = rule.substring(0, i);
                options = rule.substring(i + 1);
                // Options delimiter was found, doing nothing
                break;
            }
        }

        if (!options) {
            return null;
        }

        const optionsParts = options.split(',');
        let optionsConverted = false;

        let updatedOptionsParts = optionsParts.map((optionsPart) => {
            let convertedOptionsPart = conversionMap.get(optionsPart);

            // if option is $mp4, than it should go with $media option together
            if (optionsPart === 'mp4') {
                // check if media is not already among options
                if (!optionsParts.some((option) => option === 'media')) {
                    convertedOptionsPart = `${convertedOptionsPart},media`;
                }
            }

            if (convertedOptionsPart) {
                optionsConverted = true;
                return convertedOptionsPart;
            }

            return optionsPart;
        });

        // if has more than one csp modifiers, we merge them into one;
        const cspParts = updatedOptionsParts.filter((optionsPart) => optionsPart.startsWith('csp'));

        if (cspParts.length > 1) {
            const allButCsp = updatedOptionsParts
                .filter((optionsPart) => !optionsPart.startsWith('csp'));

            const cspValues = cspParts.map((cspPart) => cspPart.split(NAME_VALUE_SPLITTER)[1]);

            const updatedCspOption = `csp${NAME_VALUE_SPLITTER}${cspValues.join('; ')}`;
            updatedOptionsParts = allButCsp.concat(updatedCspOption);
        }

        // options without all modifier
        const hasAllOption = updatedOptionsParts.indexOf('all') > -1;

        if (hasAllOption && !conversionOptions.ignoreAllModifier) {
            // $all modifier should be converted in 4 rules
            // ||example.org^$document,popup
            // ||example.org^
            // ||example.org^$inline-font
            // ||example.org^$inline-script
            const allOptionReplacers = [
                ['document', 'popup'],
                ['inline-script'],
                ['inline-font'],
                [''], //
            ];

            return allOptionReplacers.map((replacers) => {
                // remove replacer and all option from the list
                const optionsButAllAndReplacer = updatedOptionsParts
                    .filter((option) => !(replacers.includes(option) || option === 'all'));

                // try get converted values, used for INLINE_SCRIPT_OPTION, INLINE_FONT_OPTION
                const convertedReplacers = replacers.map((replacer) => conversionMap.get(replacer) || replacer);

                // add replacer to the list of options
                const updatedOptionsString = [...convertedReplacers, ...optionsButAllAndReplacer]
                    .filter((entity) => entity)
                    .join(',');

                // create a new rule
                return updatedOptionsString.length < 1 ? domainPart : `${domainPart}$${updatedOptionsString}`;
            });
        }

        if (optionsConverted) {
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

            if ((rule.indexOf(BEFORE, i) === i + 1 || rule.indexOf(AFTER, i) === i + 1)
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

        const expressionTail = ruleText.slice(matchPathOperatorCloseBracketIndex + (isReversed ? 2 : 1));

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
     * Some options have aliases and will be replaced:
     *
     * $first-party -> $~third-party
     * $xhr -> $xmlhttprequest
     * $css -> $stylesheet
     * $frame -> $subdocument
     * $1p -> $~third-party
     * $3p -> $third-party
     * ghide -> generichide
     * ehide -> elemhide
     * doc -> document
     * queryprune -> removeparam
     */
    private static OPTIONS_ALIASES = [
        {
            alias: 'first-party',
            regex: RuleConverter.FIRST_PARTY_REGEX,
            replacement: RuleConverter.FIRST_PARTY_REPLACEMENT,
        },
        {
            alias: 'xhr',
            regex: RuleConverter.XHR_REGEX,
            replacement: RuleConverter.XHR_REPLACEMENT,
        },
        {
            alias: 'css',
            regex: RuleConverter.CSS_REGEX,
            replacement: RuleConverter.CSS_REPLACEMENT,
        },
        {
            alias: 'frame',
            regex: RuleConverter.FRAME_REGEX,
            replacement: RuleConverter.FRAME_REPLACEMENT,
        },
        {
            alias: 'queryprune',
            regex: RuleConverter.QUERY_PRUNE_REGEX,
            replacement: RuleConverter.REMOVE_PARAM_REPLACEMENT,
        },
        {
            alias: 'doc',
            regex: RuleConverter.DOC_REGEX,
            replacement: RuleConverter.DOC_REPLACEMENT,
        },
        {
            alias: '1p',
            regex: RuleConverter.THIRD_PARTY_1P_3P_REGEX,
            replacement: RuleConverter.THIRD_PARTY_1P_REPLACEMENT,
        },
        {
            alias: '3p',
            regex: RuleConverter.THIRD_PARTY_1P_3P_REGEX,
            replacement: RuleConverter.THIRD_PARTY_3P_REPLACEMENT,
        },
        {
            alias: 'ghide',
            regex: RuleConverter.GHIDE_REGEX,
            replacement: `$1${RuleConverter.GENERICHIDE}$3`,
        },
        {
            alias: 'ehide',
            regex: RuleConverter.EHIDE_REGEX,
            replacement: `$1${RuleConverter.ELEMHIDE}$3`,
        },
        {
            alias: 'shide',
            regex: RuleConverter.SHIDE_REGEX,
            replacement: `$1${RuleConverter.SPECIFICHIDE}$3`,
        },
    ];

    /**
     * Replaces the options in aliases array
     *
     * @param {string} rule
     * @return {string} convertedRule
     */
    private static replaceOptions(rule: string): string {
        if (rule.startsWith(SimpleRegex.MASK_COMMENT) || RuleFactory.isCosmetic(rule)) {
            return rule;
        }

        let result = rule;
        RuleConverter.OPTIONS_ALIASES.forEach((x) => {
            if (result.includes(x.alias) && x.regex.test(result)) {
                result = result.replace(x.regex, x.replacement);
            }
        });

        return result;
    }
}
