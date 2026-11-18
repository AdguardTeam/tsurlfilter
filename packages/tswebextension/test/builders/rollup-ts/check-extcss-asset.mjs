import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const EXTCSS_ENGINE_KEY = '__adguardExtCssEngine';

const [assetPath, expectedVersion] = process.argv.slice(2);
assert.ok(assetPath, 'ExtendedCss asset path is required');
assert.ok(expectedVersion, 'Expected ExtendedCss engine version is required');

// The smoke package deliberately has no DOM dependency. These globals are
// sufficient for module evaluation; applying rules still requires a browser.
const window = {
    Node: class {},
};
const context = {
    window,
    self: window,
    console,
    navigator: { userAgent: '' },
};

vm.runInNewContext(readFileSync(assetPath, 'utf8'), context, {
    filename: assetPath,
});

const engine = window[EXTCSS_ENGINE_KEY];
assert.ok(engine, 'The asset must install the ExtendedCss engine');
assert.equal(engine.version, expectedVersion);
assert.equal(typeof engine.applyExtendedCss, 'function');
assert.ok(engine.cssHitsHelpers, 'The asset must install the CSS-hits helpers');

const requiredHelpers = [
    'parseInfo',
    'parseExtendedStyleInfo',
    'elementToString',
    'collectExtendedCssHits',
];
for (const helper of requiredHelpers) {
    assert.equal(typeof engine.cssHitsHelpers[helper], 'function', `Missing CSS-hits helper: ${helper}`);
}

console.log(`ExtendedCss script asset installs engine version ${engine.version} and all required helpers`);
