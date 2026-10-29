import { OPTION_NAMES } from '../rule/option-names';
import { type Rule } from '../rule/rule';

/**
 * Kind of action the converter produces for a rule.
 *
 * Kinds follow the priority order of {@link RegularRuleConverter.getAction}:
 * a rule may enable several modifiers, but only the highest-priority one
 * determines the action.
 */
export enum ActionKind {
    Allow = 'allow',
    Redirect = 'redirect',
    RemoveParamRedirect = 'removeParamRedirect',
    RemoveHeader = 'removeHeader',
    Csp = 'csp',
    Permissions = 'permissions',
    Cookie = 'cookie',
    Block = 'block',
}

/**
 * Lists action kinds a rule may produce, in priority order.
 *
 * The list is structural: it contains every enabled modifier in priority
 * order plus `Block` as the fallback, so the caller can try to build an action
 * for each kind until one succeeds.
 *
 * @param rule Rule to select action kinds for.
 *
 * @returns Action kinds in priority order, the last one always being `Block`.
 */
export const selectActionKinds = (rule: Rule): ActionKind[] => {
    if (rule.allowlist) {
        return [ActionKind.Allow];
    }

    const kinds: ActionKind[] = [];

    if (rule.isModifierEnabled(OPTION_NAMES.REDIRECT)) {
        kinds.push(ActionKind.Redirect);
    }

    if (rule.isModifierEnabled(OPTION_NAMES.REMOVEPARAM)) {
        kinds.push(ActionKind.RemoveParamRedirect);
    }

    if (rule.isModifierEnabled(OPTION_NAMES.REMOVEHEADER)) {
        kinds.push(ActionKind.RemoveHeader);
    }

    if (rule.isModifierEnabled(OPTION_NAMES.CSP)) {
        kinds.push(ActionKind.Csp);
    }

    if (rule.isModifierEnabled(OPTION_NAMES.PERMISSIONS)) {
        kinds.push(ActionKind.Permissions);
    }

    if (rule.isModifierEnabled(OPTION_NAMES.COOKIE)) {
        kinds.push(ActionKind.Cookie);
    }

    kinds.push(ActionKind.Block);

    return kinds;
};

/**
 * Checks whether a kind is guaranteed to produce an action for a rule.
 *
 * Header-appending modifiers produce nothing without a value, so such a rule
 * falls through to the next kind. Modifiers which may fail on invalid input
 * (`$redirect`, `$removeparam`, `$removeheader`, `$cookie`) are treated as
 * producing an action, so the prediction never claims a lower-priority action
 * which a broken higher-priority modifier would actually replace.
 *
 * @param rule Rule to check.
 * @param kind Action kind to check.
 *
 * @returns `true` if the kind produces an action.
 */
const producesAction = (rule: Rule, kind: ActionKind): boolean => {
    switch (kind) {
        case ActionKind.Csp:
        case ActionKind.Permissions: {
            // `advancedModifierValue` holds the value of the last advanced
            // modifier, so a `$csp` value is lost when another advanced
            // modifier follows it.
            return rule.advancedModifierValue !== null;
        }
        default: {
            return true;
        }
    }
};

/**
 * Selects the action kind the converter will produce for a rule.
 *
 * @param rule Rule to select an action kind for.
 *
 * @returns First kind of {@link selectActionKinds} which produces an action.
 */
export const selectActionKind = (rule: Rule): ActionKind => {
    const kinds = selectActionKinds(rule);

    for (let i = 0; i < kinds.length; i += 1) {
        if (producesAction(rule, kinds[i])) {
            return kinds[i];
        }
    }

    return ActionKind.Block;
};

/**
 * Checks whether a rule belongs to the CSP ruleset.
 *
 * Blocking rules belong there only when the converted action appends the CSP
 * header: a rule combining `$csp` with `$redirect` or `$cookie` produces
 * another action and must be converted by the regular pass. Exceptions have no
 * converted action, so they belong there whenever `$csp` is enabled.
 *
 * @param rule Rule to check.
 *
 * @returns `true` if the rule is handled by the CSP pass.
 */
export const isCspRule = (rule: Rule): boolean => (
    rule.allowlist
        ? rule.isModifierEnabled(OPTION_NAMES.CSP)
        : selectActionKind(rule) === ActionKind.Csp
);
