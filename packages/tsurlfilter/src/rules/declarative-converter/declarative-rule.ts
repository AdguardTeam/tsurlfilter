/* eslint-disable jsdoc/require-description-complete-sentence */
/**
 * @file Describes types from declarativeNetRequest,
 * since @types/chrome does not contain actual information.
 *
 * Updated 07/09/2022.
 */

import { z as zod } from 'zod';

import { RequestType } from '../../request-type';
import { HTTPMethod } from '../../modifiers/method-modifier';

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-DomainType
 */
export enum DomainType {
    FirstParty = 'firstParty',
    ThirdParty = 'thirdParty',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType
 */
export enum ResourceType {
    MainFrame = 'main_frame',
    SubFrame = 'sub_frame',
    Stylesheet = 'stylesheet',
    Script = 'script',
    Image = 'image',
    Font = 'font',
    Object = 'object',
    XmlHttpRequest = 'xmlhttprequest',
    Ping = 'ping',
    Media = 'media',
    WebSocket = 'websocket',
    Other = 'other',
    // Temporary not using
    // CspReport = 'csp_report',
    // WebTransport = 'webtransport',
    // WebBundle = 'webbundle',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryKeyValue
 */
const QueryKeyValueValidator = zod.strictObject({
    key: zod.string(),
    replaceOnly: zod.boolean().optional(),
    value: zod.string(),
});

export type QueryKeyValue = zod.infer<typeof QueryKeyValueValidator>;

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryTransform
 */
const QueryTransformValidator = zod.strictObject({
    addOrReplaceParams: QueryKeyValueValidator.array().optional(),
    removeParams: zod.string().array().optional(),
});

export type QueryTransform = zod.infer<typeof QueryTransformValidator>;

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-URLTransform
 */
const URLTransformValidator = zod.strictObject({
    fragment: zod.string().optional(),
    host: zod.string().optional(),
    password: zod.string().optional(),
    path: zod.string().optional(),
    port: zod.string().optional(),
    query: zod.string().optional(),
    queryTransform: QueryTransformValidator.optional(),
    scheme: zod.string().optional(),
    username: zod.string().optional(),
});

export type URLTransform = zod.infer<typeof URLTransformValidator>;

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Redirect
 */
const RedirectValidator = zod.strictObject({
    extensionPath: zod.string().optional(),
    regexSubstitution: zod.string().optional(),
    transform: URLTransformValidator.optional(),
    url: zod.string().optional(),
});

export type Redirect = zod.infer<typeof RedirectValidator>;

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-HeaderOperation
 */
export enum HeaderOperation {
    Append = 'append',
    Set = 'set',
    Remove = 'remove',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ModifyHeaderInfo
 */
const ModifyHeaderInfoValidator = zod.strictObject({
    header: zod.string(),
    operation: zod.nativeEnum(HeaderOperation),
    value: zod.string().optional(),
});

export type ModifyHeaderInfo = zod.infer<typeof ModifyHeaderInfoValidator>;

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleActionType
 */
export enum RuleActionType {
    BLOCK = 'block',
    REDIRECT = 'redirect',
    ALLOW = 'allow',
    UPGRADE_SCHEME = 'upgradeScheme',
    MODIFY_HEADERS = 'modifyHeaders',
    /**
     * For allowAllRequests rules {@link RuleCondition.resourceTypes} may only
     * include the 'sub_frame' and 'main_frame' resource types.
     */
    ALLOW_ALL_REQUESTS = 'allowAllRequests',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleAction
 */
const RuleActionValidator = zod.strictObject({
    redirect: RedirectValidator.optional(),
    requestHeaders: ModifyHeaderInfoValidator.array().optional(),
    responseHeaders: ModifyHeaderInfoValidator.array().optional(),
    type: zod.nativeEnum(RuleActionType),
});

export type RuleAction = zod.infer<typeof RuleActionValidator>;

export type RuleActionHeaders = Pick<RuleAction, 'requestHeaders' | 'responseHeaders'>;

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RequestMethod
 */
export enum RequestMethod {
    Connect = 'connect',
    Delete = 'delete',
    Get = 'get',
    Head = 'head',
    Options = 'options',
    Patch = 'patch',
    Post = 'post',
    Put = 'put',
}

/**
 * tsurlfilter {@link HTTPMethod} without {@link HTTPMethod.TRACE}
 * because it is not supported by {@link RequestMethod}.
 */
export type SupportedHttpMethod = Exclude<HTTPMethod, HTTPMethod.TRACE>;

/**
 * Map {@link HTTPMethod} to declarative {@link RequestMethod}.
 */
export const DECLARATIVE_REQUEST_METHOD_MAP: Record<SupportedHttpMethod, RequestMethod> = {
    [HTTPMethod.GET]: RequestMethod.Get,
    [HTTPMethod.POST]: RequestMethod.Post,
    [HTTPMethod.PUT]: RequestMethod.Put,
    [HTTPMethod.DELETE]: RequestMethod.Delete,
    [HTTPMethod.PATCH]: RequestMethod.Patch,
    [HTTPMethod.HEAD]: RequestMethod.Head,
    [HTTPMethod.OPTIONS]: RequestMethod.Options,
    [HTTPMethod.CONNECT]: RequestMethod.Connect,
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleCondition
 */

const RuleConditionValidator = zod.strictObject({
    domainType: zod.nativeEnum(DomainType).optional(),
    excludedInitiatorDomains: zod.string().array().optional(),
    excludedRequestDomains: zod.string().array().optional(),
    excludedRequestMethods: zod.nativeEnum(RequestMethod).array().optional(),
    excludedResourceTypes: zod.nativeEnum(ResourceType).array().optional(),
    excludedTabIds: zod.number().array().optional(),
    initiatorDomains: zod.string().array().optional(),
    isUrlFilterCaseSensitive: zod.boolean().optional(),
    regexFilter: zod.string().optional(),
    requestDomains: zod.string().array().optional(),
    requestMethods: zod.nativeEnum(RequestMethod).array().optional(),
    /**
     * If none of the `excludedResourceTypes` and `resourceTypes` are specified,
     * all resource types except "main_frame" will be matched.
     */
    resourceTypes: zod.nativeEnum(ResourceType).array().optional(),
    tabIds: zod.number().array().optional(),
    urlFilter: zod.string().optional(),
});

export type RuleCondition = zod.infer<typeof RuleConditionValidator>;

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Rule
 */
export const DeclarativeRuleValidator = zod.strictObject({
    action: RuleActionValidator,
    condition: RuleConditionValidator,
    id: zod.number(),
    priority: zod.number().optional(),
});

export type DeclarativeRule = zod.infer<typeof DeclarativeRuleValidator>;

/**
 * Map request types to declarative types.
 */
export const DECLARATIVE_RESOURCE_TYPES_MAP = {
    [ResourceType.MainFrame]: RequestType.Document,
    [ResourceType.SubFrame]: RequestType.SubDocument,
    [ResourceType.Stylesheet]: RequestType.Stylesheet,
    [ResourceType.Script]: RequestType.Script,
    [ResourceType.Image]: RequestType.Image,
    [ResourceType.Font]: RequestType.Font,
    [ResourceType.Object]: RequestType.Object,
    [ResourceType.XmlHttpRequest]: RequestType.XmlHttpRequest,
    [ResourceType.Ping]: RequestType.Ping,
    // TODO: what should match this resource type?
    // [ResourceType.CSP_REPORT]: RequestType.Document,
    [ResourceType.Media]: RequestType.Media,
    [ResourceType.WebSocket]: RequestType.WebSocket,
    [ResourceType.Other]: RequestType.Other,
};
