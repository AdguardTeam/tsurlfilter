import { describe, expect, it } from 'vitest';

import {
    type DeclarativeRule,
    HeaderOperation,
    Rule,
    RuleActionType,
} from '@adguard/dnr-converter';

import { CspExceptionPlanner } from '../../../../src/lib/mv3/background/csp-exception-planner';

const createRule = (text: string): Rule => {
    const [rule] = Rule.createFromText(1, 0, text);
    return rule;
};

const createDeclarativeCspRule = (value: string): DeclarativeRule => ({
    id: 42,
    priority: 1,
    action: {
        type: RuleActionType.ModifyHeaders,
        responseHeaders: [{
            header: 'Content-Security-Policy',
            operation: HeaderOperation.Append,
            value,
        }],
    },
    condition: {
        resourceTypes: [],
    },
});

describe('CspExceptionPlanner', () => {
    it('rebuilds a grouped rule without an exactly allowlisted CSP value', () => {
        const plan = CspExceptionPlanner.plan(
            createDeclarativeCspRule("default-src 'self'; script-src 'none'"),
            [
                createRule("||example.com^$csp=default-src 'self'"),
                createRule("||example.com^$csp=script-src 'none'"),
            ],
            [createRule("@@||example.com^$csp=script-src 'none'")],
        );

        expect(plan.unsupportedExceptions).toHaveLength(0);
        expect(plan.rules).toHaveLength(1);
        expect(plan.rules[0].action.responseHeaders?.[0].value).toBe("default-src 'self'");
    });

    it('removes all matching values for an empty exact-scope CSP exception', () => {
        const plan = CspExceptionPlanner.plan(
            createDeclarativeCspRule("default-src 'self'; script-src 'none'"),
            [
                createRule("||example.com^$csp=default-src 'self'"),
                createRule("||example.com^$csp=script-src 'none'"),
            ],
            [createRule('@@||example.com^$csp')],
        );

        expect(plan.rules).toEqual([]);
    });

    it('adds a domain-only exception to excludedRequestDomains', () => {
        const plan = CspExceptionPlanner.plan(
            createDeclarativeCspRule("worker-src 'none'"),
            [createRule("||example.com^$csp=worker-src 'none'")],
            [createRule('@@||google.com^$csp')],
        );

        expect(plan.unsupportedExceptions).toHaveLength(0);
        expect(plan.rules[0].condition.excludedRequestDomains).toEqual(['google.com']);
    });

    it('keeps the rule and reports an unsupported path exception', () => {
        const exception = createRule('@@||google.com/maps*$csp');
        const plan = CspExceptionPlanner.plan(
            createDeclarativeCspRule("worker-src 'none'"),
            [createRule("||example.com^$csp=worker-src 'none'")],
            [exception],
        );

        expect(plan.rules).toHaveLength(1);
        expect(plan.rules[0].condition.excludedRequestDomains).toBeUndefined();
        expect(plan.unsupportedExceptions).toEqual([exception]);
    });

    it('does not let a non-important exception cancel an important CSP rule', () => {
        const plan = CspExceptionPlanner.plan(
            createDeclarativeCspRule("worker-src 'none'"),
            [createRule("||example.com^$csp=worker-src 'none',important")],
            [createRule('@@||example.com^$csp')],
        );

        expect(plan.rules).toHaveLength(1);
    });
});
