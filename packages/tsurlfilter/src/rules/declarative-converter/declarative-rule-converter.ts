import punycode from 'punycode/';
import { NetworkRule, NetworkRuleOption } from '../network-rule';
import { CookieModifier } from '../../modifiers/cookie-modifier';
import { RequestType } from '../../request-type';
import { logger } from '../../utils/logger';
import {
    ResourceType,
    DeclarativeRule,
    RuleAction,
    RuleActionType,
    RuleCondition,
    DomainType,
} from './declarative-rule';

/**
 * Map request types to declarative types
 */
const DECLARATIVE_RESOURCE_TYPES_MAP = {
    [ResourceType.main_frame]: RequestType.Document,
    [ResourceType.sub_frame]: RequestType.Subdocument,
    [ResourceType.stylesheet]: RequestType.Stylesheet,
    [ResourceType.script]: RequestType.Script,
    [ResourceType.image]: RequestType.Image,
    [ResourceType.font]: RequestType.Font,
    [ResourceType.object]: RequestType.Object,
    [ResourceType.xmlhttprequest]: RequestType.XmlHttpRequest,
    [ResourceType.ping]: RequestType.Ping,
    // [ResourceType.csp_report]: RequestType.Document, // TODO what should match this resource type?
    [ResourceType.media]: RequestType.Media,
    [ResourceType.websocket]: RequestType.Websocket,
    [ResourceType.webrtc]: RequestType.Webrtc,
    [ResourceType.other]: RequestType.Other,
};

/**
 * Rule priority. Defaults to 1. When specified, should be >= 1.
 */
export enum DeclarativeRulePriority {
    DocumentException = 4,
    ImportantException = 3,
    Important = 2,
    Exception = 1,
}

/**
 * Rule Converter class
 * Converts an instance of NetworkRule to DeclarativeRule
 *
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Rule
 */
export class DeclarativeRuleConverter {
    /**
     * Gets resource type matching request type
     *
     * @param requestTypes
     */
    private static getResourceTypes(requestTypes: RequestType): ResourceType[] {
        return Object.entries(DECLARATIVE_RESOURCE_TYPES_MAP)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .filter(([, requestType]) => (requestTypes & requestType) === requestType)
            .map(([resourceTypeKey]) => ResourceType[resourceTypeKey as ResourceType]);
    }

    private static isASCII(str: string) {
        // eslint-disable-next-line no-control-regex
        return /^[\x00-\x7F]+$/.test(str);
    }

    /**
     * Converts to punycode non if string contains non ASCII characters
     * @param str
     * @private
     */
    private static prepareASCII(str: string) {
        if (DeclarativeRuleConverter.isASCII(str)) {
            return str;
        }
        return punycode.toASCII(str);
    }

    /**
     * The entries must consist of only ascii characters
     *
     * @param domains
     */
    private static prepareDomains(domains: string[]): string[] {
        return domains.map((domain) => {
            return DeclarativeRuleConverter.prepareASCII(domain);
        });
    }

    /**
     * Rule priority. Defaults to 1. When specified, should be >= 1.
     *
     * document exceptions > allowlist + $important > $important > allowlist > basic rules
     *
     * @param rule
     */
    private static getPriority(rule: NetworkRule): number | null {
        if (rule.isDocumentAllowlistRule()) {
            return DeclarativeRulePriority.DocumentException;
        }

        const isImportant = rule.isOptionEnabled(NetworkRuleOption.Important);
        const isAllowlist = rule.isAllowlist();

        if (isImportant) {
            return isAllowlist ? DeclarativeRulePriority.ImportantException : DeclarativeRulePriority.Important;
        }

        if (isAllowlist) {
            return DeclarativeRulePriority.Exception;
        }

        return null;
    }

    /**
     * Rule action
     *
     * @param rule
     */
    private static getAction(rule: NetworkRule): RuleAction {
        const action = {} as RuleAction;

        // TODO RuleAction
        //  - redirect?: Redirect;
        //  - requestHeaders?: ModifyHeaderInfo[];
        //  - responseHeaders?: ModifyHeaderInfo[];
        //  - type: RuleActionType;
        // TODO RuleActionType
        //  - 'redirect' = 'redirect',
        //  - 'upgradeScheme' = 'upgradeScheme',
        //  - 'modifyHeaders' = 'modifyHeaders',
        //  - 'allowAllRequests' = 'allowAllRequests',

        if (rule.isAllowlist()) {
            action.type = RuleActionType.allow;
        } else {
            action.type = RuleActionType.block;
        }

        return action;
    }

    /**
     * Rule condition
     *
     * @param rule
     */
    private static getCondition(rule: NetworkRule): RuleCondition {
        const condition = {} as RuleCondition;

        const pattern = rule.getPattern();
        if (pattern) {
            // set regexFilter
            if (rule.isRegexRule()) {
                // TODO consider MAX_NUMBER_OF_REGEX_RULES
                // eslint-disable-next-line max-len
                //  https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#property-MAX_NUMBER_OF_REGEX_RULES
                condition.regexFilter = DeclarativeRuleConverter.prepareASCII(pattern);
            } else {
                // A pattern beginning with ||* is not allowed. Use * instead.
                const patternWithoutVerticals = pattern.startsWith('||*') ? pattern.substring(2) : pattern;
                condition.urlFilter = DeclarativeRuleConverter.prepareASCII(patternWithoutVerticals);
            }
        }

        // set domainType
        if (rule.isOptionEnabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.thirdParty;
        } else if (rule.isOptionDisabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.firstParty;
        }

        // set domains
        const permittedDomains = rule.getPermittedDomains();
        if (permittedDomains && permittedDomains.length > 0) {
            condition.domains = this.prepareDomains(permittedDomains);
        }

        // set excludedDomains
        const excludedDomains = rule.getRestrictedDomains();
        if (excludedDomains && excludedDomains.length > 0) {
            condition.excludedDomains = this.prepareDomains(excludedDomains);
        }

        // set excludedResourceTypes
        const restrictedRequestTypes = rule.getRestrictedRequestTypes();
        const hasExcludedResourceTypes = restrictedRequestTypes !== 0;
        if (hasExcludedResourceTypes) {
            condition.excludedResourceTypes = this.getResourceTypes(restrictedRequestTypes);
        }

        // set resourceTypes
        const permittedRequestTypes = rule.getPermittedRequestTypes();
        if (!hasExcludedResourceTypes && permittedRequestTypes !== 0) {
            condition.resourceTypes = this.getResourceTypes(permittedRequestTypes);
        }

        // set isUrlFilterCaseSensitive
        condition.isUrlFilterCaseSensitive = rule.isOptionEnabled(NetworkRuleOption.MatchCase);

        // eslint-disable-next-line no-param-reassign
        return condition;
    }

    /**
     * Converts a rule to declarative rule
     *
     * @param rule - network rule
     * @param id - rule identifier
     */
    static convert(rule: NetworkRule, id: number): DeclarativeRule | null {
        if (rule.getAdvancedModifier() instanceof CookieModifier) {
            logger.info(`Error: cookies rules are not supported: "${rule.getText()}"`);
            return null;
        }

        const declarativeRule = {} as DeclarativeRule;

        const priority = this.getPriority(rule);
        if (priority) {
            declarativeRule.priority = priority;
        }
        declarativeRule.id = id;
        declarativeRule.action = this.getAction(rule);
        declarativeRule.condition = this.getCondition(rule);

        const { regexFilter, resourceTypes } = declarativeRule.condition;

        // https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType
        if (resourceTypes?.includes(ResourceType.webrtc)) {
            logger.info(`Error: WebRTC resource type is not supported in Manifest V3: "${rule.getText()}"`);
            return null;
        }

        // More complex regex than allowed as part of the "regexFilter" key.
        if (regexFilter?.match(/\|/g)) {
            const regexArr = regexFilter.split('|');
            // TODO Find how exactly the complexity of a rule is calculated.
            // The values maxGroups & maxGroupLength are obtained by testing.
            const maxGroups = 15;
            const maxGroupLength = 31;
            if (regexArr.length > maxGroups || regexArr.some(i => i.length > maxGroupLength)) {
                logger.info(`Error: more complex regex than allowed: "${rule.getText()}"`);
                return null;
            }
        }

        // backreference; possessive; negative lookahead not supported;
        // https://github.com/google/re2/wiki/Syntax
        if (regexFilter?.match(/\\[1-9]|(?<!\\)\?|{\S+}/g)) {
            logger.info(`Error: invalid regex in the: "${rule.getText()}"`);
            return null;
        }

        return declarativeRule;
    }
}
