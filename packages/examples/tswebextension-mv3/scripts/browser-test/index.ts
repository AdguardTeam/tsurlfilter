import { chromium } from 'playwright';

import {
    BUILD_PATH,
    USER_DATA_PATH,
    DEFAULT_EXTENSION_CONFIG,
    TESTCASES_BASE_URL,
} from '../constants';
import {
    addQunitListeners,
    setTsWebExtensionConfig,
    SetTsWebExtensionConfigArg,
} from './page-injections';
import { getTestcases, getRuleText } from './requests';
import { filterCompatibleTestcases } from './testcase';
import { logTestResult } from './logger';
import { Product } from './product';

(async () => {
    // Launch browser with installed extension
    const browserContext = await chromium.launchPersistentContext(USER_DATA_PATH, {
        headless: false,
        args: [
            `--disable-extensions-except=${BUILD_PATH}`,
            `--load-extension=${BUILD_PATH}`,
        ],
    });

    const backgroundPage = await browserContext.waitForEvent('serviceworker');

    const page = await browserContext.newPage();

    const testcases = await getTestcases();

    const compatibleTestcases = filterCompatibleTestcases(testcases, Product.CHROME);

    // register function, that transfer args from page to playwright context
    // installed function survive navigations.
    await page.exposeFunction('logTestResult', logTestResult);

    // extends QUnit instance on creation by custom event listeners,
    // that triggers exposed function
    await page.addInitScript(addQunitListeners, 'logTestResult');


    // run testcases
    for (const testcase of compatibleTestcases) {

        // TODO: implement separate e2e test for popups
        // ignore popup tests
        if (!testcase.rulesUrl) {
            continue;
        }

        // load rules text for current testcase
        const userrules = await getRuleText(testcase.rulesUrl);

        // update tsWebExtension config
        await backgroundPage.evaluate<void, SetTsWebExtensionConfigArg>(
            setTsWebExtensionConfig,
            [DEFAULT_EXTENSION_CONFIG, userrules],
        );

        // run test page
        await page.goto(`${TESTCASES_BASE_URL}/${testcase.link}`, { waitUntil: 'networkidle' });
    }

    await browserContext.close();
})();
