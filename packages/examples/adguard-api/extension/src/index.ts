/* eslint-disable no-console */
import browser from 'webextension-polyfill';
import {
    AdguardApi,
    type Configuration,
    type RequestBlockingEvent,
    MESSAGE_HANDLER_NAME,
} from '@adguard/api';

(async (): Promise<void> => {
    // create new AdguardApi instance
    const adguardApi = await AdguardApi.create();

    let configuration: Configuration = {
        filters: [
            2,
            215, // example of obsoleted filter.
        ],
        filteringEnabled: true,
        allowlist: ['www.example.com'],
        /* eslint-disable @typescript-eslint/quotes */
        rules: [
            'example.org##h1',
            `#%#console.log('generic script injected at: ', Date.now());`,
            `#%#//scriptlet('log', 'generic scriptlet injected')`,
            `example.net#%#console.log('specific script injected at: ', Date.now());`,
            `example.net#%#//scriptlet('log', 'specific scriptlet injected')`,
        ],
        /* eslint-enable @typescript-eslint/quotes */
        filterRulesUrl: 'https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt',
        filtersMetadataUrl: 'https://filters.adtidy.org/extension/chromium/filters.json',
    };

    // console log event on request blocking
    const onRequestBlocked = (event: RequestBlockingEvent) => {
        console.log(event);
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log('Total rules count:', adguardApi.getRulesCount());
    };

    adguardApi.onRequestBlocked.addListener(onRequestBlocked);

    configuration = await adguardApi.start(configuration);

    console.log('Finished Adguard API initialization.');
    console.log('Applied configuration: ', JSON.stringify(configuration));
    logTotalCount();

    configuration.allowlist!.push('www.google.com');

    await adguardApi.configure(configuration);

    console.log('Finished Adguard API re-configuration');
    logTotalCount();

    const onAssistantCreateRule = async (rule: string) => {
        // update config on assistant rule apply
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        configuration.rules!.push(rule);
        await adguardApi.configure(configuration);
        console.log('Finished Adguard API re-configuration');
        logTotalCount();
    };

    adguardApi.onAssistantCreateRule.subscribe(onAssistantCreateRule);

    const onFiltersDeletion = async (filterIds: number[]) => {
        console.log(`Filters with ids ${filterIds} deleted because they became obsoleted.`);
        configuration.filters = configuration.filters.filter((id) => !filterIds.includes(id));

        await adguardApi.configure(configuration);

        console.log('Finished Adguard API re-configuration');
        logTotalCount();
    };

    // update config on filter deletion
    adguardApi.onFiltersDeletion.subscribe(onFiltersDeletion);

    // get tswebextension message handler
    const handleApiMessage = adguardApi.getMessageHandler();

    // define custom message handler
    const handleAppMessage = async (message: any) => {
        switch (message.type) {
            case 'OPEN_ASSISTANT': {
                const active = await browser.tabs.query({ active: true });
                if (active[0]?.id) {
                    await adguardApi.openAssistant(active[0].id);
                }
                break;
            }
            default:
            // do nothing
        }
    };

    browser.runtime.onMessage.addListener(async (message, sender) => {
        // route message depending on handler name
        if (message?.handlerName === MESSAGE_HANDLER_NAME) {
            return Promise.resolve(handleApiMessage(message, sender));
        }
        return handleAppMessage(message);
    });

    // Disable Adguard in 1 minute
    setTimeout(async () => {
        adguardApi.onRequestBlocked.removeListener(onRequestBlocked);
        adguardApi.onAssistantCreateRule.unsubscribe(onAssistantCreateRule);
        adguardApi.onFiltersDeletion.unsubscribe(onFiltersDeletion);
        await adguardApi.stop();
        console.log('Adguard API has been disabled.');
    }, 60 * 1000);
})();
