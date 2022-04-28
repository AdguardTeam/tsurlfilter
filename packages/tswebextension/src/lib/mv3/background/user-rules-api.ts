import {
    DeclarativeConverter,
    StringRuleList,
} from '@adguard/tsurlfilter';

const USER_FILTER_ID = 0;

export default class UserRulesApi {
    /**
     * Updates dynamic rules via declarativeNetRequest
     * @param userrules string[] contains custom user rules
     * @param resoursesPath string path to web accessible resourses,
     * relative to the extension root dir. Should start with leading slash '/'
     */
    public static async updateDynamicFiltering(
        userrules: string[],
        resoursesPath?: string,
    ): Promise<void> {
        const converter = new DeclarativeConverter();
        const list = new StringRuleList(USER_FILTER_ID, userrules.join('\n'), false);
        const convertedRules = converter.convert(list, {
            resoursesPath,
        });

        // remove existing dynamic rules, in order their ids not interfere with new
        await this.removeAllRules();
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: convertedRules });
    }

    /**
     * Disables all enabled dynamic rules
     */
    public static async removeAllRules(): Promise<void> {
        // get existing dynamic rules
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRulesIds = existingRules.map((rule) => rule.id);

        // remove existing dynamic rules
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRulesIds });
    }
}
