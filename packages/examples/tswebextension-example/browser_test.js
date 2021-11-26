const path = require("path");
const puppeteer = require("puppeteer");
const axios = require("axios");
const chalk = require("chalk");


const baseURL = 'https://testcases.adguard.com';

axios.defaults.baseURL = baseURL;

const pathToExtension = path.join(__dirname, "build");

const defaultConfig = {
  filters: [],
  allowlist: [],
  userrules: [],
  verbose: false,
  settings: {
    collectStats: true,
    allowlistInverted: false,
    stealth: {
      blockChromeClientData: true,
      hideReferrer: true,
      hideSearchQueries: true,
      sendDoNotTrack: true,
      blockWebRTC: true,
      selfDestructThirdPartyCookies: true,
      selfDestructThirdPartyCookiesTime: 3600,
      selfDestructFirstPartyCookies: true,
      selfDestructFirstPartyCookiesTime: 3600,
    },
  },
};


const getColorStatus = (status) => status === 'passed' ? chalk.green(status) : chalk.red(status);

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

  // Get testcases data

  await page.goto(baseURL, { waitUntil: 'networkidle0' });

  const testcases = await page.evaluate(() => {
    const testInfocontainers = document.querySelectorAll('div.test-info');

    const testcases = [];

    for (let testInfocontainer of testInfocontainers) {
      const compatibility = testInfocontainer.querySelector('div.full-compatibility').textContent;

      if (compatibility.indexOf('Chrome') > 0) {
        const testTitleElement = testInfocontainer.querySelector('a.test-title');

        const title = testTitleElement.textContent;
        const pageUrl = '/' + testTitleElement.getAttribute('href');

        const rulesUrl = pageUrl.slice(0, pageUrl.lastIndexOf('.html')) + '.txt';

        testcases.push({
          title,
          pageUrl,
          rulesUrl,
        })
      }
    }

    console.log(testcases)
    return testcases;
  });


  // register function, that transfer args from page to puppeteer context
  // installed function survive navigations.
  await page.exposeFunction('logRunEnd', async (details) => {

    const counts = details.testCounts;
  
    console.log('Name:', details.name)

    console.log('Status:', getColorStatus(details.status));
    console.log('Total %d tests: %d passed, %d failed, %d skipped',
      counts.total,
      counts.passed,
      counts.failed,
      counts.skipped
    );
    console.log('Duration:', details.runtime, '\n')

    const tests = details.tests

    for(let i = 0; i < tests.length; i++) {
      const test = tests[i]

      console.log(test.name, getColorStatus(test.status))
    }

    console.log('\n');
  });

  // extends QUnit instance on creation by custom event listeners,
  // that triggers exposed function
  await page.evaluateOnNewDocument(() => {
    let qUnit;
    Object.defineProperty(window, 'QUnit', {
      get: () => qUnit,
      set: (value) => {
        qUnit = value;

        console.log(qUnit);

        // https://github.com/js-reporters/js-reporters
        qUnit.on('runEnd', details => {
          window.logRunEnd(details)
        })
      },
      configurable: true,
    });
  });

  // run testcases
  for (let testcase of testcases) {

    let rulesText;

    // load rules text for current testcase
    try {
      const res = await axios.get(testcase.rulesUrl, {
        validateStatus: (status) => {
          return status === 200; // Resolve only if the status code is 200
        },
      });
      
      rulesText = res.data;
    } catch (e) {
      console.log(e.mesage);
    }

    if(!rulesText){
      continue;
    }

    // update tsWebExtension config
    await backgroundPage.evaluate(async (defaultConfig, rulesText) => {
      await window.tsWebExtension.configure({
        ...defaultConfig,
        filters: [{
          filterId: 1,
          content: rulesText
        }],
      })
    }, defaultConfig, rulesText);

    // run test page
    await page.goto(`${baseURL}${testcase.pageUrl}`, { waitUntil: 'networkidle0'});
  }

  await browser.close();
})();