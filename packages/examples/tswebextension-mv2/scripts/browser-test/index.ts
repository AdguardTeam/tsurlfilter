import { chromium } from 'playwright';

import {
    TESTCASES_BASE_URL,
    BUILD_PATH,
    USER_DATA_PATH,
    DEFAULT_EXTENSION_CONFIG,
} from '../constants';

import { getTestcases, getRuleText } from './requests';
import {
    addQunitListeners,
    setTsWebExtensionConfig,
    SetTsWebExtensionConfigArg,
} from './page-injections';

import { logTestResult } from './logger';
import { Product } from './product';
import { filterCompatibleTestcases } from './testcase';

(async () => {
    // Launch browser with installed extension
    const browserContext = await chromium.launchPersistentContext(USER_DATA_PATH, {
        headless: false,
        args: [
            `--disable-extensions-except=${BUILD_PATH}`,
            `--load-extension=${BUILD_PATH}`,
        ],
    });

    const backgroundPage = await browserContext.waitForEvent('backgroundpage');

    // Wait for tsWebExtension start
    await backgroundPage.waitForFunction(() => window.tsWebExtension?.isStarted, null, { polling: 100 });

    const page = await browserContext.newPage();


    const testcases = await getTestcases();

    const compatibleTestcases = filterCompatibleTestcases(testcases, Product.CHROME);

    // register function, that transfer args from page to puppeteer context
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
        const rulesText = await getRuleText(testcase.rulesUrl);

        // update tsWebExtension config
        await backgroundPage.evaluate<void, SetTsWebExtensionConfigArg>(
            setTsWebExtensionConfig,
            [DEFAULT_EXTENSION_CONFIG, rulesText],
        );

        // run test page
        await page.goto(`${TESTCASES_BASE_URL}/${testcase.link}`, { waitUntil: 'networkidle' });
    }

    await browserContext.close();
})();

/*
TODO: ff webextension e2e testing (if possible)

ff launch snippet:

await webExt.cmd.run({
    sourceDir: BUILD_PATH,
        firefox: firefox.executablePath(),
        args: [`--remote-debugging-port`, `${FF_DEBUG_PORT}`],
    }, {
        shouldExitProgram: false,
});

// Wait for ff loads debug server
execSync('sleep 2');

// get WS Endpont url
const res = await axios.get(`http://localhost:${FF_DEBUG_PORT}/json/version`);

const wsEndpoint = res.data.webSocketDebuggerUrl;

// connect playwright
// playwright internal error 
const browser = await firefox.connect(wsEndpoint);

*/
