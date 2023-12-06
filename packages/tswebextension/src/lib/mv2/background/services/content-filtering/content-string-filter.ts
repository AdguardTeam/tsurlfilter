import type {
    NetworkRule,
    ReplaceModifier,
    CosmeticRule,
} from '@adguard/tsurlfilter';
import { nanoid } from 'nanoid';

import { FilteringEventType, type FilteringLog } from '../../../../common/filtering-log';
import { getDomain } from '../../../../common/utils/url';

import type { RequestContext } from '../../request';
import { documentParser } from './doc-parser';
import { HtmlRuleParser } from './rule/html-rule-parser';
import { HtmlRuleSelector } from './rule/html-rule-selector';
import { EntityHandler } from './entity-handler';

export interface ContentStringFilterInterface {
    /**
     * Applies Html and Replace rules to content string.
     */
    applyRules: (content: string) => string;
}

/**
 * Content string filter.
 */
export class ContentStringFilter implements ContentStringFilterInterface {
    context: RequestContext;

    htmlRules: CosmeticRule[] | null;

    replaceRules: NetworkRule[] | null;

    filteringLog: FilteringLog;

    /**
     * Creates an instance of ContentStringFilter.
     *
     * @param context Request context.
     * @param htmlRules Html rules.
     * @param replaceRules Replace rules.
     * @param filteringLog Filtering log.
     */
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

    /**
     * Applies Html and Replace rules to content string.
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#replace-modifier}
     *
     * @param content Content string.
     * @returns Modified content string.
     */
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

    /**
     * Applies Html rules to content string.
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
     *
     * @param content Content string.
     * @returns Modified content string.
     */
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

                        const {
                            tabId,
                            requestUrl,
                            timestamp,
                            contentType,
                        } = this.context;

                        this.filteringLog.publishEvent({
                            type: FilteringEventType.ApplyCosmeticRule,
                            data: {
                                tabId,
                                eventId: nanoid(),
                                element: element.innerHTML,
                                frameUrl: requestUrl,
                                rule,
                                frameDomain: getDomain(requestUrl) as string,
                                requestType: contentType,
                                timestamp,
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
            return doctype + EntityHandler.revertEntities(doc.documentElement.outerHTML);
        }

        return content;
    }

    /**
     * Applies "replace" rules to content string.
     *
     * @param content Content string.
     * @returns Modified content string.
     */
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

        const { tabId, eventId } = this.context;

        if (appliedRules.length > 0) {
            this.filteringLog.publishEvent({
                type: FilteringEventType.ReplaceRuleApply,
                data: {
                    tabId,
                    eventId,
                    rules: appliedRules,
                },
            });
        }

        return modifiedContent;
    }
}
