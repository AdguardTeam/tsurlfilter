import puppeteer from "puppeteer";

import { 
    BASE_URL,
    EXTENSION_PATH,
    DEFAULT_EXTENSION_CONFIG,
} from "./constants";

import { getTestcases, getRuleText } from "./requests";
import { addQunitListeners, setTsWebExtensionConfig } from "./page-injections";

import { logTestResult } from "./logger";
import { Product } from "./product";
import { filterCompatibleTestcases } from './testcase';

(async () => {
    // Launch browser with installed extension
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
        ],
    });

    const targets = browser.targets();
    const backgroundPageTarget = targets.find(
        (target) => target.type() === 'background_page'
    );
    const backgroundPage = await backgroundPageTarget.page();


    // Wait for tsWebExtension start
    await backgroundPage.waitForFunction('window.tsWebExtension?.isStarted', { polling: 100 });

    const page = await browser.newPage();


    const testcases = await getTestcases();

    const compatibleTestcases = filterCompatibleTestcases(testcases, Product.CHR);

    // register function, that transfer args from page to puppeteer context
    // installed function survive navigations.
    await page.exposeFunction('logTestResult', logTestResult);

    // extends QUnit instance on creation by custom event listeners,
    // that triggers exposed function
    await page.evaluateOnNewDocument(addQunitListeners, 'logTestResult');

    // run testcases
    for (let testcase of compatibleTestcases) {

        // TODO: implement separate e2e test for popups
        // ignore popup tests
        if(!testcase.rulesUrl){
            continue;
        }
        
        // load rules text for current testcase
        const rulesText = await getRuleText(testcase.rulesUrl);

        // update tsWebExtension config
        await backgroundPage.evaluate(setTsWebExtensionConfig, DEFAULT_EXTENSION_CONFIG, rulesText);

        // run test page
        await page.goto(`${BASE_URL}/${testcase.link}`, { waitUntil: 'networkidle0' });
    }

    await browser.close();
})();
