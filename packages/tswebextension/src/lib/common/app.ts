import { ConfigurationMV2, ConfigurationMV3 } from './configuration';
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

interface AppInterface {
    /**
     * Is app started
     */
    isStarted: boolean;

    /**
     * Fires on filtering log event
     */
    onFilteringLogEvent: EventChannelInterface<FilteringLogEvent>,

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

export type AppInterfaceMV2 = AppInterface & {
    /**
     * Current Configuration object
     */
    configuration?: ConfigurationMV2;

    /**
      * Starts api
      * @param configuration
      */
    start: (configuration: ConfigurationMV2) => Promise<void>;

    /**
      * Updates configuration
      * @param configuration
      */
    configure: (configuration: ConfigurationMV2) => Promise<void>;
};

export type AppInterfaceMV3 = AppInterface & {
    /**
     * Current Configuration object
     */
    configuration?: ConfigurationMV3;

    /**
      * Starts api
      * @param configuration
      */
    start: (configuration: ConfigurationMV3) => Promise<void>;

    /**
      * Updates configuration
      * @param configuration
      */
    configure: (configuration: ConfigurationMV3) => Promise<void>;
};
