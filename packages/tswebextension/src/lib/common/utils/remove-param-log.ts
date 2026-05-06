import { FilteringEventType, type FilteringLog } from '../filtering-log';
import { type LogRemoveParamEventPayload } from '../message';
import { ContentType } from '../request-type';

import { nanoid } from './nanoid';
import { getRuleTextsByIndex, type RuleTextProvider } from './rule-text-provider';
import { getDomain } from './url';

/**
 * Publishes remove-param filtering log events for each applied descriptor.
 *
 * This is shared logic used by both MV2 and MV3 message handlers after
 * the payload has been validated.
 *
 * @param tabId Tab identifier from the message sender.
 * @param payload Validated log remove-param event payload.
 * @param filteringLog Filtering log instance to publish events to.
 * @param ruleTextProvider Provider for looking up rule texts by index.
 *
 * @returns True if at least one event was published.
 */
export function publishRemoveParamEvents(
    tabId: number,
    payload: LogRemoveParamEventPayload,
    filteringLog: FilteringLog,
    ruleTextProvider: RuleTextProvider,
): boolean {
    const { url, appliedDescriptors } = payload;

    for (const descriptor of appliedDescriptors) {
        const { appliedRuleText, originalRuleText } = getRuleTextsByIndex(
            descriptor.filterId,
            descriptor.ruleIndex,
            ruleTextProvider,
        );

        filteringLog.publishEvent({
            type: FilteringEventType.RemoveParam,
            data: {
                removeParam: true,
                eventId: nanoid(),
                tabId,
                requestUrl: url,
                frameUrl: url,
                frameDomain: getDomain(url) || '',
                requestType: ContentType.Document,
                filterId: descriptor.filterId,
                ruleIndex: descriptor.ruleIndex,
                appliedRuleText,
                originalRuleText,
                timestamp: Date.now(),
                isAllowlist: descriptor.isAllowlist,
                isImportant: descriptor.isImportant,
                isDocumentLevel: false,
                isCsp: false,
                isCookie: false,
                advancedModifier: descriptor.advancedModifier,
            },
        });
    }

    return appliedDescriptors.length > 0;
}
