/**
 * Extra scripts to be added to local_script_rules.js during build
 * and referenced at runtime.
 */
export const extraScripts = [
    '#%#//scriptlet(\'log\', \'generic scriptlet injected from local script rules\')',
    'example.net#%#//scriptlet(\'log\', \'specific scriptlet injected from local script rules\')',
    '#%#console.log(\'generic script injected from local script rules at: \', Date.now());',
    'example.net#%#console.log(\'specific script injected from local script rules at: \', Date.now());',
];
