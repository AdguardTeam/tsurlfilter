import { defaultFilteringLog, FilteringEventType } from '@adguard/tswebextension/mv3';

import { logger } from './state';

/**
 * Subscribes to basic network rule matches and prints them to the console.
 */
export const startFilteringLog = () => {
    defaultFilteringLog.addEventListener(FilteringEventType.ApplyBasicRule, (event) => {
        logger.info('[tswebexample.filtering-log]: basic rule matched', event.data);
    });
};
