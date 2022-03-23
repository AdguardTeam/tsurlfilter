import {
    DeclarativeConverter,
    StringRuleList,
} from '@adguard/tsurlfilter';

const USER_FILTER_ID = 0;

export default class UserRulesAPI {
    public static async updateDynamicFiltering(userrules: string[]): Promise<void> {
        const converter = new DeclarativeConverter();
        const list = new StringRuleList(USER_FILTER_ID, userrules.join('\n'), false);
        const convertedRules = converter.convert(list);

        // get existing dynamic rules
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRulesIds = existingRules.map((rule) => rule.id);

        // remove existing dynamic rules, in order their ids not interfere with new
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRulesIds });
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: convertedRules });
    }
}
