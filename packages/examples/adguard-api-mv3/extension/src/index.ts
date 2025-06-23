/* eslint-disable no-console */
import browser from 'webextension-polyfill';
import {
    AdguardApi,
    type Configuration,
    MESSAGE_HANDLER_NAME,
    type RequestBlockingEvent,
} from '@adguard/api-mv3';

(async (): Promise<void> => {
    // create new AdguardApi instance
    const adguardApi = await AdguardApi.create();

    // console log event on request blocking
    const onRequestBlocked = (event: RequestBlockingEvent) => {
        console.log(event);
    };

    adguardApi.onRequestBlocked.addListener(onRequestBlocked);

    let configuration: Configuration = {
        // Note: this list should not contain filter 24, because it has not
        // included in dnr-rulesets, only in the metadata.
        filters: [
            2,
            3,
            4,
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
                // We need the last focused window because if the assistant is opened in incognito mode,
                // it won’t be clear where to inject the assistant. AG-42726
                const currentWindow = await browser.windows.getLastFocused();
                const [activeTab] = await browser.tabs.query({ active: true, windowId: currentWindow.id });
                if (activeTab?.id) {
                    await adguardApi.openAssistant(activeTab.id);
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

    // Disable Adguard in 2 minute, since one minute might not be enough for testing
    setTimeout(async () => {
        adguardApi.onRequestBlocked.removeListener(onRequestBlocked);
        adguardApi.onAssistantCreateRule.unsubscribe(onAssistantCreateRule);
        await adguardApi.stop();
        console.log('Adguard API MV3 has been disabled.');
    }, 2 * 60 * 1000);
})();
