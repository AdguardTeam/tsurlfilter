import { FilteringLogEvent } from './filtering-log';
import { EventChannelInterface } from './utils';

/*
 * Returns information about state for site
 */
export const enum SiteStatus {
    /**
    * AdBlocker can't apply rules on this site
    */
    SiteInException = 'SITE_IN_EXCEPTION',
    /**
    * Site is in the allowlist
    */
    SiteAllowlisted = 'SITE_ALLOWLISTED',

    /**
    * Filtering on the site is working as expected
    */
    FilteringEnabled = 'FILTERING_ENABLED',
}

export interface AppInterface<TConfiguration, TConfigurationContext = TConfiguration> {
    /**
     * Configuration context
     */
    configuration?: TConfigurationContext;

    /**
     * Is app started
     */
    isStarted: boolean;

    /**
     * Fires on filtering log event
     */
    onFilteringLogEvent: EventChannelInterface<FilteringLogEvent>,

    /**
      * Starts api
      * @param configuration
      */
    start: (configuration: TConfiguration) => Promise<void>;

    /**
     * Updates configuration
     * @param configuration
     */
    configure: (configuration: TConfiguration) => Promise<void>;

    /**
     * Stops api
     */
    stop: () => Promise<void>;

    /**
     * Launches assistant in the current tab
     */
    openAssistant: (tabId: number) => void;

    /**
     * Closes assistant
     */
    closeAssistant: (tabId: number) => void;

    /**
     * Returns current status for site
     */
    getSiteStatus(url: string): SiteStatus,

    /**
     * Returns number of active rules
     */
    getRulesCount(): number,
}
