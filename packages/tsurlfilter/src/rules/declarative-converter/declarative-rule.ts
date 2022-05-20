/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-DomainType
 */
export enum DomainType {
    FIRST_PARTY = 'firstParty',
    THIRD_PARTY = 'thirdParty',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType
 */
export enum ResourceType {
    MAIN_FRAME = 'main_frame',
    SUB_FRAME = 'sub_frame',
    STYLESHEET = 'stylesheet',
    SCRIPT = 'script',
    IMAGE = 'image',
    FONT = 'font',
    OBJECT = 'object',
    XMLHTTPREQUEST = 'xmlhttprequest',
    PING = 'ping',
    CSP_REPORT = 'csp_report',
    MEDIA = 'media',
    WEBSOCKET = 'websocket',
    OTHER = 'other',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryKeyValue
 */
export interface QueryKeyValue {
    key: string;
    value: string;
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryTransform
 */
export interface QueryTransform {
    addOrReplaceParams?: QueryKeyValue[] | undefined;
    removeParams?: string[] | undefined;
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-URLTransform
 */
export interface URLTransform {
    fragment?: string | undefined;
    host?: string | undefined;
    password?: string | undefined;
    path?: string | undefined;
    port?: string | undefined;
    query?: string | undefined;
    queryTransform?: QueryTransform | undefined;
    scheme?: string | undefined;
    username?: string | undefined;
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Redirect
 */
export interface Redirect {
    extensionPath?: string | undefined;
    regexSubstitution?: string | undefined;
    transform?: URLTransform | undefined;
    url?: string | undefined;
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-HeaderOperation
 */
export enum HeaderOperation {
    APPEND = 'append',
    SET = 'set',
    REMOVE = 'remove',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ModifyHeaderInfo
 */
export interface ModifyHeaderInfo {
    header: string;
    operation: HeaderOperation;
    value?: string | undefined;
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleActionType
 */
export enum RuleActionType {
    BLOCK = 'block',
    REDIRECT = 'redirect',
    ALLOW = 'allow',
    UPGRADE_SCHEME = 'upgradeScheme',
    MODIFY_HEADERS = 'modifyHeaders',
    ALLOW_ALL_REQUESTS = 'allowAllRequests',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleAction
 */
export interface RuleAction {
    redirect?: Redirect;
    requestHeaders?: ModifyHeaderInfo[];
    responseHeaders?: ModifyHeaderInfo[];
    type: RuleActionType;
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleCondition
 */
export interface RuleCondition {
    domainType?: DomainType;
    initiatorDomains?: string[];
    excludedInitiatorDomains?: string[];
    excludedRequestDomains?: string [];
    excludedResourceTypes?: ResourceType[];
    isUrlFilterCaseSensitive?: boolean;
    regexFilter?: string;
    resourceTypes?: ResourceType[];
    urlFilter?: string;
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Rule
 */

export interface DeclarativeRule {
    action: RuleAction;
    condition: RuleCondition;
    id: number;
    // In chrome.declarativeNetRequest.Rule priority is not optional, although in the documentation it is.
    // TODO fix when it will correct.
    priority: number;
}
