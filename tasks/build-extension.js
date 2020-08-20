const fs = require('fs-extra');

const EXTENSION_SRC = './sample-extension/';
const TSURLFILTER_DIST = './dist/tsurlfilter.esm.js';
const TSURLFILTER_CONTENT_SCRIPT_DIST = './dist/TSUrlFilterContentScript.js';
const EXTENSION_DIST = './dist-extension/';

fs.copySync(EXTENSION_SRC, EXTENSION_DIST);
fs.copySync(TSURLFILTER_DIST, `${EXTENSION_DIST}engine.js`);
fs.copySync(TSURLFILTER_CONTENT_SCRIPT_DIST, `${EXTENSION_DIST}engine-content-script.js`);
