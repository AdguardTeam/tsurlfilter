import {
    NetworkRule,
    ReplaceModifier,
    CosmeticRule,
} from '@adguard/tsurlfilter';
import { FilteringEventType, FilteringLog } from '../../../../common';

import { RequestContext } from '../../request';
import { documentParser } from './doc-parser';
import { HtmlRuleParser } from './rule/html-rule-parser';
import { HtmlRuleSelector } from './rule/html-rule-selector';

export interface ContentStringFilterInterface {
    /**
     * Applies Html and Replace rules to content string.
     */
    applyRules: (content: string) => string;
}

export class ContentStringFilter implements ContentStringFilterInterface {
    context: RequestContext;

    htmlRules: CosmeticRule[] | null;

    replaceRules: NetworkRule[] | null;

    filteringLog: FilteringLog;

    constructor(
        context: RequestContext,
        htmlRules: CosmeticRule[] | null,
        replaceRules: NetworkRule[] | null,
        filteringLog: FilteringLog,
    ) {
        this.context = context;
        this.htmlRules = htmlRules;
        this.replaceRules = replaceRules;
        this.filteringLog = filteringLog;
    }

    public applyRules(content: string): string {
        if (this.htmlRules && this.htmlRules.length > 0) {
            content = this.applyHtmlRules(content);
        }

        if (this.replaceRules
            && this.replaceRules.length > 0
            // response content is over 3MB, ignore it
            && content.length <= 3 * 1024 * 1024
        ) {
            content = this.applyReplaceRules(content);
        }

        return content;
    }

    private applyHtmlRules(content: string): string {
        const doc = documentParser.parse(content);

        if (!doc) {
            return content;
        }

        const deleted = [];

        for (let i = 0; i < this.htmlRules!.length; i += 1) {
            const rule = this.htmlRules![i];

            const parsed = HtmlRuleParser.parse(rule);
            const elements = new HtmlRuleSelector(parsed).getMatchedElements(doc);
            if (elements) {
                for (let j = 0; j < elements.length; j += 1) {
                    const element = elements[j];
                    if (element.parentNode && deleted.indexOf(element) < 0) {
                        element.parentNode.removeChild(element);

                        const { tabId, requestId, requestUrl } = this.context;

                        this.filteringLog.publishEvent({
                            type: FilteringEventType.HTTP_RULE_APPLY,
                            data: {
                                tabId,
                                requestId,
                                elementString: element.innerHTML,
                                frameUrl: requestUrl!,
                                rule,
                            },
                        });

                        deleted.push(element);
                    }
                }
            }
        }

        // Add <!DOCTYPE html ... >
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/959
        // XMLSerializer is used to serialize doctype object
        // eslint-disable-next-line no-undef
        const doctype = doc.doctype ? `${new XMLSerializer().serializeToString(doc.doctype)}\r\n` : '';

        if (deleted.length > 0) {
            return doctype + doc.documentElement.outerHTML;
        }

        return content;
    }

    private applyReplaceRules(content: string): string {
        const appliedRules = [];

        let modifiedContent = content;

        for (let i = 0; i < this.replaceRules!.length; i += 1) {
            const replaceRule = this.replaceRules![i];
            if (replaceRule.isAllowlist()) {
                appliedRules.push(replaceRule);
            } else {
                const advancedModifier = replaceRule.getAdvancedModifier() as ReplaceModifier;
                modifiedContent = advancedModifier.getApplyFunc()(modifiedContent);
                appliedRules.push(replaceRule);
            }
        }

        const { tabId, requestId, requestUrl } = this.context;

        if (appliedRules.length > 0) {
            this.filteringLog.publishEvent({
                type: FilteringEventType.REPLACE_RULE_APPLY,
                data: {
                    tabId,
                    requestId,
                    frameUrl: requestUrl!,
                    rules: appliedRules,
                },
            });
        }

        return modifiedContent;
    }
}
