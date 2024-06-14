/* eslint-disable no-console */
import browser from 'webextension-polyfill';
import { AdguardApi, type Configuration, MESSAGE_HANDLER_NAME } from '@adguard/api-mv3';

(async (): Promise<void> => {
    // create new AdguardApi instance
    const adguardApi = await AdguardApi.create();

    let configuration: Configuration = {
        filters: [
            1,
            2,
            3,
            4,
            9,
            14,
        ],
        filteringEnabled: true,
        allowlist: ['www.example.com'],
        rules: ['example.org##h1'],
        assetsPath: 'filters',
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log('Total rules count:', adguardApi.getRulesCount());
    };

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
        // adguardApi.onRequestBlocked.removeListener(onRequestBlocked);
        adguardApi.onAssistantCreateRule.unsubscribe(onAssistantCreateRule);
        await adguardApi.stop();
        console.log('Adguard API has been disabled.');
    }, 60 * 1000);
})();
