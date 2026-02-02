import { type NetworkRule, type ReplaceModifier, type CosmeticRule } from '@adguard/tsurlfilter';
import { CosmeticRuleType } from '@adguard/agtree';

import { FilteringEventType, type FilteringLog } from '../../../../common/filtering-log';
import { nanoid } from '../../../../common/utils/nanoid';
import { getDomain } from '../../../../common/utils/url';
import { getRuleTexts, type RuleTextProvider } from '../../../../common/utils/rule-text-provider';
import { type RequestContext } from '../../request';
import { logger } from '../../../../common/utils/logger';
import { type RuleInfo } from '../../../../common/rule-info';

import { documentParser } from './doc-parser';
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

    engineApi: RuleTextProvider;

    /**
     * Creates an instance of ContentStringFilter.
     *
     * @param context Request context.
     * @param htmlRules Html rules.
     * @param replaceRules Replace rules.
     * @param filteringLog Filtering log.
     * @param ruleTextProvider Rule text provider.
     */
    constructor(
        context: RequestContext,
        htmlRules: CosmeticRule[] | null,
        replaceRules: NetworkRule[] | null,
        filteringLog: FilteringLog,
        ruleTextProvider: RuleTextProvider,
    ) {
        this.context = context;
        this.htmlRules = htmlRules;
        this.replaceRules = replaceRules;
        this.filteringLog = filteringLog;
        this.engineApi = ruleTextProvider;
    }

    /**
     * Applies Html and Replace rules to content string.
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#replace-modifier}
     *
     * @param content Content string.
     *
     * @returns Modified content string.
     */
    public applyRules(content: string): string {
        if (this.htmlRules && this.htmlRules.length > 0) {
            content = this.applyHtmlRules(content);
        }

        if (this.replaceRules
            && this.replaceRules.length > 0
            // response content is over 10MB, ignore it
            // AG-41962
            && content.length <= 10 * 1024 * 1024
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
     *
     * @returns Modified content string.
     */
    private applyHtmlRules(content: string): string {
        const doc = documentParser.parse(content);

        if (!doc) {
            return content;
        }

        const deleted: Set<Element> = new Set();

        for (let i = 0; i < this.htmlRules!.length; i += 1) {
            const rule = this.htmlRules![i];
            const selectorList = rule.getHtmlSelectorList();

            if (!selectorList) {
                logger.info(`[tsweb.ContentStringFilter.applyHtmlRules]: ignoring rule with invalid HTML selector: ${rule.getContent()}`);
                continue;
            }

            const elements = new HtmlRuleSelector(selectorList).getMatchedElements(doc);
            for (let j = 0; j < elements.length; j += 1) {
                const element = elements[j];
                if (element.parentNode && !deleted.has(element)) {
                    element.parentNode.removeChild(element);

                    const {
                        tabId,
                        requestUrl,
                        timestamp,
                        contentType,
                    } = this.context;

                    const ruleType = rule.getType();
                    const { appliedRuleText, originalRuleText } = getRuleTexts(rule, this.engineApi);

                    this.filteringLog.publishEvent({
                        type: FilteringEventType.ApplyCosmeticRule,
                        data: {
                            tabId,
                            eventId: nanoid(),
                            element: element.innerHTML,
                            frameUrl: requestUrl,
                            filterId: rule.getFilterListId(),
                            ruleIndex: rule.getIndex(),
                            appliedRuleText,
                            originalRuleText,
                            frameDomain: getDomain(requestUrl) as string,
                            requestType: contentType,
                            timestamp,
                            cssRule: ruleType === CosmeticRuleType.ElementHidingRule
                                    || ruleType === CosmeticRuleType.CssInjectionRule,
                            scriptRule: ruleType === CosmeticRuleType.ScriptletInjectionRule
                                    || ruleType === CosmeticRuleType.JsInjectionRule,
                            contentRule: ruleType === CosmeticRuleType.HtmlFilteringRule,
                        },
                    });

                    deleted.add(element);
                }
            }
        }

        // Add <!DOCTYPE html ... >
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/959
        // XMLSerializer is used to serialize doctype object
        // eslint-disable-next-line no-undef
        const doctype = doc.doctype ? `${new XMLSerializer().serializeToString(doc.doctype)}\r\n` : '';

        if (deleted.size > 0) {
            // `documentElement` might be null in case if the rule matches entire document
            // For example: `$$:contains(test)`, this is valid case and matches CoreLibs behavior
            const docHtml = doc.documentElement?.outerHTML || '';

            return doctype + EntityHandler.revertEntities(docHtml);
        }

        return content;
    }

    /**
     * Applies "replace" rules to content string.
     *
     * @param content Content string.
     *
     * @returns Modified content string.
     */
    private applyReplaceRules(content: string): string {
        const appliedRules = [];

        let modifiedContent = content;

        for (let i = 0; i < this.replaceRules!.length; i += 1) {
            const replaceRule = this.replaceRules![i];
            const replaceRuleInfo: RuleInfo = {
                filterId: replaceRule.getFilterListId(),
                ruleIndex: replaceRule.getIndex(),
                ...getRuleTexts(replaceRule, this.engineApi),
            };
            if (replaceRule.isAllowlist()) {
                appliedRules.push(replaceRuleInfo);
            } else {
                const advancedModifier = replaceRule.getAdvancedModifier() as ReplaceModifier;
                modifiedContent = advancedModifier.getApplyFunc()(modifiedContent);
                appliedRules.push(replaceRuleInfo);
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
