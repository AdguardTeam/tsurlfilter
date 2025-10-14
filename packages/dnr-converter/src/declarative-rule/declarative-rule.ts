import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

import { type RuleAction, RuleActionValidator } from './rule-action';
import { type RuleCondition, RuleConditionValidator } from './rule-condition';

/**
 * Interface that represents declarative rule that will apply {@link action} when {@link condition} is fulfilled.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-Rule}
 */
export interface DeclarativeRule {
    /**
     * The action to take if this rule is matched.
     *
     * @see {@link RuleAction}
     */
    action: RuleAction;

    /**
     * The condition under which this rule is triggered.
     *
     * @see {@link RuleCondition}
     */
    condition: RuleCondition;

    /**
     * An id which uniquely identifies a rule. Mandatory and should be >= `1`.
     */
    id: number;

    /**
     * Rule priority. Defaults to `1`. When specified, should be >= `1`.
     */
    priority?: number;
}

/**
 * Validator for {@link DeclarativeRule}.
 */
export const DeclarativeRuleValidator = strictObjectByType<DeclarativeRule>({
    action: RuleActionValidator,
    condition: RuleConditionValidator,
    id: v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
    ),
    priority: v.optional(v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
    )),
});
