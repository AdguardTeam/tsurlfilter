/**
 * @file Exports all types from `declarativeNetRequest`,
 * since `@types/chrome` does not contain actual information.
 *
 * Last Updated 06/10/2025.
 */

export { type DeclarativeRule, DeclarativeRuleValidator } from './declarative-rule';

export { HeaderOperation } from './modify-header-info';

export { RuleActionType } from './rule-action';

export { URLTransformScheme } from './url-transform';

export {
    DomainType,
    RequestMethod,
    ResourceType,
} from './rule-condition';
