/**
 * @file You can specify the resources to benchmark in this file
 */

import { type ResourceConfigs } from '../common/interfaces';

/**
 * Resources to benchmark
 */
export const resourceConfigs: ResourceConfigs = {
    Bootstrap: {
        url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.css',
    },
    Bulma: {
        url: 'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.css',
    },
    Foundation: {
        url: 'https://cdn.jsdelivr.net/npm/foundation-sites@6.8.1/dist/css/foundation.css',
    },
    'Fomantic UI': {
        url: 'https://cdn.jsdelivr.net/npm/fomantic-ui@2.9.3/dist/semantic.css',
    },
    'Font Awesome': {
        url: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.2/css/all.css',
    },
    'jQuery UI': {
        url: 'https://cdn.jsdelivr.net/npm/jquery-ui-dist@1.13.2/jquery-ui.css',
    },
    'AdGuard Base List': {
        url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_Base/filter.txt',
        adblock: true,
    },
    'AdGuard Annoyances Filter': {
        url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_14_Annoyances/filter.txt',
        adblock: true,
    },
    'AdGuard Mobile Ads Filter': {
        url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_11_Mobile/filter.txt',
        adblock: true,
    },
    'uBlock Base List': {
        url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
        adblock: true,
    },
};
