import webExt from 'web-ext';
import { firefox } from 'playwright';
import { BUILD_PATH } from './constants';

/**
 * helper script for launch ff with loaded extension on testcases page
 */

webExt.cmd.run({
    sourceDir: BUILD_PATH,
    firefox: firefox.executablePath(),
    args: [ '-new-tab', 'https://testcases.adguard.com/'],
}, {
    shouldExitProgram: false,
});
