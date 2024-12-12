import browser from 'webextension-polyfill';

import DynamicRulesApi from '../../../../src/lib/mv3/background/dynamic-rules-api';
import { ALLOWLIST_FILTER_ID, QUICK_FIXES_FILTER_ID, USER_FILTER_ID } from '../../../../src/lib/common/constants';
import { createFilter } from '../helpers';

describe('DynamicRulesApi', () => {
    describe('updateDynamicFiltering', () => {
        it('prioritizes rules in next order: quick fixes -> allowlist -> userrules -> custom filters', async () => {
            // Manually create the mock structure for browser.declarativeNetRequest
            const mockDeclarativeNetRequest = {
                getDynamicRules: vi.fn().mockResolvedValue([]),
                updateDynamicRules: vi.fn().mockResolvedValue({}),
                MAX_NUMBER_OF_DYNAMIC_RULES: 1,
                MAX_NUMBER_OF_REGEX_RULES: 0,
            };

            // Override the browser object with the mock
            // @ts-ignore
            browser.declarativeNetRequest = mockDeclarativeNetRequest;

            const quickFixesRule = '@@example.com$document';
            const userRule = 'example.org';
            const allowlistRule = '@@$document,to=example.org';
            const customRule = 'example.com';

            // Test with MAX_NUMBER_OF_DYNAMIC_RULES set to 1
            let conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([quickFixesRule], QUICK_FIXES_FILTER_ID),
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], 1000)],
                [],
            );

            let declarativeRules = await conversionResult.ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.urlFilter).toBe('example.com');

            // Change MAX_NUMBER_OF_DYNAMIC_RULES to 2
            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = 2;

            conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([quickFixesRule], QUICK_FIXES_FILTER_ID),
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], 1000)],
                [],
            );

            declarativeRules = await conversionResult.ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.urlFilter).toBe('example.com');
            expect(declarativeRules[1].action.type).toBe('allowAllRequests');
            expect(declarativeRules[1].condition.requestDomains![0]).toBe('example.org');

            // Change MAX_NUMBER_OF_DYNAMIC_RULES to 3
            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = 3;

            conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([quickFixesRule], QUICK_FIXES_FILTER_ID),
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], 1000)],
                [],
            );

            declarativeRules = await conversionResult.ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(3);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.urlFilter).toBe('example.com');
            expect(declarativeRules[1].action.type).toBe('allowAllRequests');
            expect(declarativeRules[1].condition.requestDomains![0]).toBe('example.org');
            expect(declarativeRules[2].condition.urlFilter).toBe('example.org');

            // Change MAX_NUMBER_OF_DYNAMIC_RULES to 4
            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = 4;

            conversionResult = await DynamicRulesApi.updateDynamicFiltering(
                createFilter([quickFixesRule], QUICK_FIXES_FILTER_ID),
                createFilter([allowlistRule], ALLOWLIST_FILTER_ID),
                createFilter([userRule], USER_FILTER_ID),
                [createFilter([customRule], 1000)],
                [],
            );

            declarativeRules = await conversionResult.ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(4);
            expect(declarativeRules[0].action.type).toBe('allowAllRequests');
            expect(declarativeRules[0].condition.urlFilter).toBe('example.com');
            expect(declarativeRules[1].action.type).toBe('allowAllRequests');
            expect(declarativeRules[1].condition.requestDomains![0]).toBe('example.org');
            expect(declarativeRules[2].condition.urlFilter).toBe('example.org');
            expect(declarativeRules[3].condition.urlFilter).toBe('example.com');

            // Clean up the mock after the test
            // @ts-ignore
            delete browser.declarativeNetRequest;
        });
    });
});
