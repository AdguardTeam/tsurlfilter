/**
 * @file Exports all types from `declarativeNetRequest`,
 * since `@types/chrome` does not contain actual information.
 *
 * Last Updated 06/10/2025.
 */

export { type DeclarativeRule, DeclarativeRuleValidator } from './declarative-rule';

export { type ModifyHeaderInfo, HeaderOperation } from './modify-header-info';

export { type Redirect } from './redirect';

export {
    type RuleAction,
    type RuleActionHeaders,
    RuleActionType,
} from './rule-action';

export {
    type RuleCondition,
    DomainType,
    RequestMethod,
    ResourceType,
} from './rule-condition';

export { URLTransformScheme } from './url-transform';
