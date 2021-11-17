const path = require("path");
const puppeteer = require("puppeteer");

const pathToExtension = path.join(__dirname, "build");

(async () => {
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

  await backgroundPage.waitForFunction('window.tsWebExtension?.isStarted', { polling: 100 });

  await backgroundPage.evaluate(async () => {
    await window.tsWebExtension.configure({
      filters: [{
        filterId: 1,
        content: `!
          !
          ! Title: Rules for simple rules tests
          !
          ! Filter to be used for testing purposes
          ! https://testcases.adguard.com
          !
          ! Hide warning
          testcases.adguard.com,surge.sh###subscribe-to-test-simple-rules-filter
          ! Test case 1: domain-specific elemhide rule
          testcases.adguard.com,surge.sh###case-1-elemhide > .test-banner
          ! Test case 2: generic elemhide rule
          ###case-2-generic-elemhide > .test-banner
          ! Test case 3: elemhide rule exception
          ###case-3-elemhide-exception > .test-banner
          testcases.adguard.com,surge.sh#@##case-3-elemhide-exception > .test-banner
          ! Test case 3: wildcard exception
          testcases.adguard.com,surge.sh###case-3-elemhide-exception > h1
          *#@##case-3-elemhide-exception > h1
          ! Test case 3: generic exception
          testcases.adguard.com,surge.sh###case-3-elemhide-exception > h2
          #@##case-3-elemhide-exception > h2
          ! Test case 3: generic exception for generic elemhide
          ###case-3-elemhide-exception > h3
          #@##case-3-elemhide-exception > h3
          ! Test case 4: domain exclusion
          ~testcases.adguard.com,~surge.sh###case-4-domain-exclusion > .test-banner
          ! Test case 5: wildcard for tld
          testcases.adguard.*,surge.*###case-5-wildcard-for-tld > .test-banner
          ! Test case 6: wildcard for tld support with $domain modifier
          ||*/tld-test-files/$image,domain=testcases.adguard.*|surge.*
          ||*/tld*$script,domain=testcases.adguard.*|surge.*
          ! Test case 7: $third-party modifier
          ||antibanner.net^$third-party
          ! Test case 8: $subdocument modifier
          ||*/iframe-test-1.html^$subdocument,domain=testcases.adguard.com|surge.sh
          ||*/iframe-test-2.html^$domain=testcases.adguard.com|surge.sh
          @@||*/iframe-test-2.html^$subdocument,domain=testcases.adguard.com|surge.sh`
      }],
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
    })
  })

  const page = await browser.newPage();

  await page.goto('https://testcases.adguard.com/Filters/simple-rules/test-simple-rules.html');

  //await browser.close();
})();