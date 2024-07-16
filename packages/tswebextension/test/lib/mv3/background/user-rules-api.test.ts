import browser from 'webextension-polyfill';
import UserRulesApi from '@lib/mv3/background/user-rules-api';
import { Filter, type IFilter } from '@adguard/tsurlfilter/es/declarative-converter';

const createFilter = (content: string[], filterId: number): IFilter => {
    return new Filter(
        filterId,
        { getContent: (): Promise<string[]> => Promise.resolve(content) },
        true,
    );
};

describe('UserRulesApi', () => {
    describe('updateDynamicFiltering', () => {
        it('prioritizes rules in next order: allowlist -> userrules -> custom filters', async () => {
            // Manually create the mock structure for browser.declarativeNetRequest
            const mockDeclarativeNetRequest = {
                getDynamicRules: jest.fn().mockResolvedValue([]),
                updateDynamicRules: jest.fn().mockResolvedValue({}),
                MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 1,
                MAX_NUMBER_OF_REGEX_RULES: 1,
            };

            // Override the browser object with the mock
            // @ts-ignore
            browser.declarativeNetRequest = mockDeclarativeNetRequest;

            const userRule = 'example.org';
            const allowlistRule = '@@$document,to=example.org';
            const customRule = 'example.com';

            // Test with MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES set to 1
            let conversionResult = await UserRulesApi.updateDynamicFiltering(
                [userRule],
                allowlistRule,
                [createFilter([customRule], 1000)],
                [],
            );

            let declarativeRules = await conversionResult.ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action.type === 'allowAllRequests').toBe(true);
            expect(declarativeRules[0].condition.requestDomains![0] === 'example.org').toBe(true);

            // Change MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES to 2
            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES = 2;

            conversionResult = await UserRulesApi.updateDynamicFiltering(
                [userRule],
                allowlistRule,
                [createFilter([customRule], 1000)],
                [],
            );

            declarativeRules = await conversionResult.ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0].action.type === 'allowAllRequests').toBe(true);
            expect(declarativeRules[0].condition.requestDomains![0] === 'example.org').toBe(true);
            expect(declarativeRules[1].condition.urlFilter === 'example.org').toBe(true);

            // Change MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES to 3
            mockDeclarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES = 3;

            conversionResult = await UserRulesApi.updateDynamicFiltering(
                [userRule],
                allowlistRule,
                [createFilter([customRule], 1000)],
                [],
            );

            declarativeRules = await conversionResult.ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(3);
            expect(declarativeRules[0].action.type === 'allowAllRequests').toBe(true);
            expect(declarativeRules[0].condition.requestDomains![0] === 'example.org').toBe(true);
            expect(declarativeRules[1].condition.urlFilter === 'example.org').toBe(true);
            expect(declarativeRules[2].condition.urlFilter === 'example.com').toBe(true);

            // Clean up the mock after the test
            // @ts-ignore
            delete browser.declarativeNetRequest;
        });
    });
});
