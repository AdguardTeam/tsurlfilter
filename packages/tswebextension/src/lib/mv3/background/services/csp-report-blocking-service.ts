// FIXME extract all session predefined rule ids to the separate module, so that it can be used in stealh service
// and csp report blocking service
export const CSP_REPORT_BLOCKING_RULE_ID = 5;

// FIXME add tests for this service

// FIXME consider cases
//  1. when whole filtering is disabled
//  2. when only one site filtering is disabled (allowlist, @@||example.com$document — general exception rules, )
export class CspReportBlockingService {
    // FIXME add jsdoc
    static init() {
        CspReportBlockingService.addCspReportBlockingRule();
        console.log('chrome.declarativeNetRequest.ResourceType.CSP_REPORT', chrome.declarativeNetRequest.ResourceType.CSP_REPORT);
        console.log('chrome.declarativeNetRequest.RuleActionType.BLOCK', chrome.declarativeNetRequest.RuleActionType.BLOCK);
        console.log('chrome.declarativeNetRequest.DomainType.THIRD_PARTY', chrome.declarativeNetRequest.DomainType.THIRD_PARTY);
    }

    // FIXME add jsdoc
    static addCspReportBlockingRule() {
        const rule: chrome.declarativeNetRequest.Rule = {
            id: CSP_REPORT_BLOCKING_RULE_ID,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.BLOCK,
            },
            condition: {
                urlFilter: '*',
                resourceTypes: [chrome.declarativeNetRequest.ResourceType.CSP_REPORT],
                domainType: chrome.declarativeNetRequest.DomainType.THIRD_PARTY,
            },
        };

        // FIXME update via session rules api
        chrome.declarativeNetRequest.updateSessionRules({
            addRules: [rule],
            removeRuleIds: [rule.id],
        });
    }
}
