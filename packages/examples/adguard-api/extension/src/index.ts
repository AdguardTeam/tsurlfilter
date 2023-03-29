/* eslint-disable no-console */
import { AdguardApi, Configuration, RequestBlockingEvent } from "@adguard/api";

(async (): Promise<void> => {
    // create new AdguardApi instance
    const adguardApi = AdguardApi.create();

    const configuration: Configuration = {
        filters: [2],
        allowlist: ["www.example.com"],
        rules: ["example.org##h1"],
        filterRulesUrl: "https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt",
        filtersMetadataUrl: "https://filters.adtidy.org/extension/chromium/filters.json",
    };

    // console log event on request blocking
    const onRequestBlocked = (event: RequestBlockingEvent) => {
        console.log(event);
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log("Total rules count:", adguardApi.getRulesCount());
    };

    adguardApi.onRequestBlocked.addListener(onRequestBlocked);

    await adguardApi.start(configuration);

    console.log("Finished Adguard API initialization.");
    logTotalCount();

    configuration.allowlist!.push("www.google.com");

    await adguardApi.configure(configuration);

    console.log("Finished Adguard API re-configuration");
    logTotalCount();

    // update config on assistant rule apply
    adguardApi.onAssistantCreateRule.subscribe(async (rule) => {
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        configuration.rules!.push(rule);
        await adguardApi.configure(configuration);
        console.log("Finished Adguard API re-configuration");
        logTotalCount();
    });

    chrome.runtime.onMessage.addListener(async (message) => {
        switch (message.type) {
            case "OPEN_ASSISTANT": {
                chrome.tabs.query({ active: true }, async (res) => {
                    if (res[0]?.id) {
                        await adguardApi.openAssistant(res[0].id);
                    }
                });
                break;
            }
            default:
            // do nothing
        }
    });

    // Disable Adguard in 1 minute
    setTimeout(async () => {
        adguardApi.onRequestBlocked.removeListener(onRequestBlocked);
        await adguardApi.stop();
        console.log("Adguard API has been disabled.");
    }, 60 * 1000);
})();
