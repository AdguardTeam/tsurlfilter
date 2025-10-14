import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

import { type ModifyHeaderInfo, ModifyHeaderInfoValidator } from './modify-header-info';
import { type Redirect, RedirectValidator } from './redirect';

/**
 * Enum that represents the kind of action to take if a given condition matches.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleActionType}
 */
export enum RuleActionType {
    /**
     * Block the network request.
     */
    Block = 'block',

    /**
     * Redirect the network request.
     */
    Redirect = 'redirect',

    /**
     * Allow the network request.
     *
     * The request won't be intercepted if there is an allow rule which matches it.
     */
    Allow = 'allow',

    /**
     * Upgrade the network request url's scheme to `https` if the request is `http` or `ftp`.
     */
    UpgradeScheme = 'upgradeScheme',

    /**
     * Modify request/response headers from the network request.
     *
     * @since Chrome 86
     */
    ModifyHeaders = 'modifyHeaders',

    /**
     * Allow all requests within a frame hierarchy, including the frame request itself.
     */
    AllowAllRequests = 'allowAllRequests',
}

/**
 * Interface that represents a rule action to be performed when a rule condition is matched.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleAction}
 */
export interface RuleAction {
    /**
     * Describes how the redirect should be performed. Only valid for redirect rules.
     */
    redirect?: Redirect;

    /**
     * The request headers to modify for the request. Only valid for modify headers rules.
     *
     * @since Chrome 86
     */
    requestHeaders?: ModifyHeaderInfo[];

    /**
     * The response headers to modify for the request. Only valid for modify headers rules.
     *
     * @since Chrome 86
     */
    responseHeaders?: ModifyHeaderInfo[];

    /**
     * The type of action to perform.
     */
    type: RuleActionType;
}

/**
 * Validator for {@link RuleAction}.
 */
export const RuleActionValidator = strictObjectByType<RuleAction>({
    redirect: v.optional(RedirectValidator),
    requestHeaders: v.optional(v.array(ModifyHeaderInfoValidator)),
    responseHeaders: v.optional(v.array(ModifyHeaderInfoValidator)),
    type: v.enum(RuleActionType),
});
