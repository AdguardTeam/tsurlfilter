/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-DomainType
 */
export enum DomainType {
    'firstParty' = 'firstParty',
    'thirdParty' = 'thirdParty',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType
 */
export enum ResourceType {
    'main_frame' = 'main_frame',
    'sub_frame' = 'sub_frame',
    'stylesheet' = 'stylesheet',
    'script' = 'script',
    'image' = 'image',
    'font' = 'font',
    'object' = 'object',
    'xmlhttprequest' = 'xmlhttprequest',
    'ping' = 'ping',
    'csp_report' = 'csp_report',
    'media' = 'media',
    'websocket' = 'websocket',
    'other' = 'other',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryKeyValue
 */
export type QueryKeyValue = {
    key: string;
    value: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryTransform
 */
export type QueryTransform = {
    addOrReplaceParams?: QueryKeyValue[];
    removeParams?: string[];
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-URLTransform
 */
export type URLTransform = {
    fragment?: string;
    host?: string;
    password?: string;
    path?: string;
    port?: string;
    query?: string;
    queryTransform?: QueryTransform;
    scheme?: string;
    username?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Redirect
 */
export type Redirect = {
    extensionPath?: string;
    regexSubstitution?: string;
    transform?: URLTransform;
    url?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-HeaderOperation
 */
export enum HeaderOperation {
    append = 'append',
    set = 'set',
    remove = 'remove',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ModifyHeaderInfo
 */
export type ModifyHeaderInfo = {
    header: string;
    operation: HeaderOperation;
    value?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleActionType
 */
export enum RuleActionType {
    'block' = 'block',
    'redirect' = 'redirect',
    'allow' = 'allow',
    'upgradeScheme' = 'upgradeScheme',
    'modifyHeaders' = 'modifyHeaders',
    'allowAllRequests' = 'allowAllRequests',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleAction
 */
export type RuleAction = {
    redirect?: Redirect;
    requestHeaders?: ModifyHeaderInfo[];
    responseHeaders?: ModifyHeaderInfo[];
    type: RuleActionType;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleCondition
 */
export type RuleCondition = {
    domainType?: DomainType;
    domains?: string[];
    excludedDomains?: string[];
    excludedResourceTypes?: ResourceType[];
    isUrlFilterCaseSensitive?: boolean;
    regexFilter?: string;
    resourceTypes?: ResourceType[];
    urlFilter?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Rule
 */
export type DeclarativeRule = {
    id: number;
    priority?: number;
    action: RuleAction;
    condition: RuleCondition;
};
