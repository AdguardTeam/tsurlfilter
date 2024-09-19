const { tokenize } = require('@adguard/css-tokenizer');
const { ok } = require('assert');

let tokensCount = 0;

tokenize('div { color: red; }', () => {
    tokensCount += 1;
});

ok(tokensCount > 0);

console.log('Smoke test passed');
