const path = require("path");
const puppeteer = require("puppeteer");
const axios = require("axios");


const baseURL = 'https://testcases.adguard.com';

axios.defaults.baseURL = baseURL;

const pathToExtension = path.join(__dirname, "build");


const testcases = [
  {
    rulesUrl: '/Filters/simple-rules/test-simple-rules.txt',
    pageUrl: '/Filters/simple-rules/test-simple-rules.html'
  },
  {
    rulesUrl: '/Filters/simple-rules/generichide-test/generichide-test.txt',
    pageUrl: '/Filters/simple-rules/generichide-test/generichide-test.html'
  }
];

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

  // register function, that transfer args from page to puppeteer context
  // installed function survive navigations.
  await page.exposeFunction('logDone', async (details) => {
    console.log(details);
  });

  // extends QUnit instance on creation by custom event listeners,
  // that triggers exposed function
  await page.evaluateOnNewDocument(() => {
    let qUnit;
    Object.defineProperty(window, 'QUnit', {
      get: () => qUnit,
      set: (value) => {
        qUnit = value;

        qUnit.done(details => {
          window.logDone(details)
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