/* eslint-disable no-console, no-undef, import/extensions, import/no-unresolved,import/no-extraneous-dependencies */
import * as TSUrlFilter from '@adguard/tsurlfilter';

/**
 * Applies cookie rules via content-script
 *
 * @param tabId
 * @param rules
 */
export const applyCookieRules = (tabId, rules) => {
    if (!rules || rules.length === 0) {
        return;
    }

    // eslint-disable-next-line arrow-body-style
    const rulesData = rules.map((rule) => {
        return {
            ruleText: rule.getText(),
            match: rule.getAdvancedModifierValue(),
            isThirdParty: rule.isOptionEnabled(TSUrlFilter.NetworkRuleOption.ThirdParty),
            filterId: rule.getFilterListId(),
        };
    });

    chrome.tabs.executeScript(tabId, {
        code: `
                (() => {
                    const rulesData = JSON.parse('${JSON.stringify(rulesData)}');
                    
                    const { CookieController } = TSUrlFilterContentScript;
                    const cookieController = new CookieController((
                            cookieName, cookieDomain, ruleText, thirdParty, filterId) => {
                        console.debug('Cookie rule applied');
                        console.debug(ruleText);
                        console.debug(cookieName);
                    });
                    
                    cookieController.apply(rulesData);
                    
                    console.debug('CookieController initialized');
                })();
            `,
    });
};
