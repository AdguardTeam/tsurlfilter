const puppeteer = require("puppeteer");
const { loadRulesText } = require("./requests");

const { 
    baseUrl,
    pathToExtension,
    defaultExtensionConfig
} = require("./config");

const {
    getTestcasesData,
    addQunitListeners,
    setTsWebExtensionConfig
} = require("./page-injections");

const { logTestResult } = require("./logger");

(async () => {
    // Launch browser with installed extension
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
        ],
    });

    const targets = await browser.targets();
    const backgroundPageTarget = targets.find(
        (target) => target.type() === 'background_page'
    );
    const backgroundPage = await backgroundPageTarget.page();


    // Wait for tsWebExtension start
    await backgroundPage.waitForFunction('window.tsWebExtension?.isStarted', { polling: 100 });

    const page = await browser.newPage();

    await page.goto(baseUrl, { waitUntil: 'networkidle0' });

    const testcases = await page.evaluate(getTestcasesData);


    // register function, that transfer args from page to puppeteer context
    // installed function survive navigations.
    await page.exposeFunction('logTestResult', logTestResult);

    // extends QUnit instance on creation by custom event listeners,
    // that triggers exposed function
    await page.evaluateOnNewDocument(addQunitListeners, 'logTestResult');

    // run testcases
    for (let testcase of testcases) {

        // load rules text for current testcase
        const rulesText = await loadRulesText(testcase.rulesUrl);

        if (!rulesText) {
            continue;
        }

        // update tsWebExtension config
        await backgroundPage.evaluate(setTsWebExtensionConfig, defaultExtensionConfig, rulesText);

        // run test page
        await page.goto(`${baseUrl}${testcase.pageUrl}`, { waitUntil: 'networkidle0' });
    }

    await browser.close();
})();
