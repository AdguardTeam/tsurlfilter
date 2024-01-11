/**
 * @file You can specify the resources to benchmark in this file
 */

import { type ResourceConfigs } from '../common/interfaces';

/**
 * Resources to benchmark
 */
export const resourceConfigs: ResourceConfigs = {
    'AdGuard Base List': {
        url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_Base/filter.txt',
    },
    'AdGuard Annoyances Filter': {
        url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_14_Annoyances/filter.txt',
    },
    'AdGuard Mobile Ads Filter': {
        url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_11_Mobile/filter.txt',
    },
    'uBlock Base List': {
        url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
    },
    EasyList: {
        url: 'https://easylist.to/easylist/easylist.txt',
    },

    // Other resources - these are used for testing purposes only, so we keep them commented out
    // 'AG Base Ad Servers': {
    //     url: 'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/adservers.txt',
    // },
    // 'AG Base Anti Adblock': {
    //     url: 'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/antiadblock.txt',
    // }
};
