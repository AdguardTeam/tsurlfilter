'use strict';

var utils = require('@typescript-eslint/utils');
var jsRules = require('@stylistic/eslint-plugin-js');

const createRule = utils.ESLintUtils.RuleCreator(
  (name) => `https://eslint.style/rules/ts/${name}`
);

let segmenter;
function isASCII(value) {
  return /^[\u0020-\u007F]*$/u.test(value);
}
function getStringLength(value) {
  if (isASCII(value))
    return value.length;
  segmenter ?? (segmenter = new Intl.Segmenter());
  return [...segmenter.segment(value)].length;
}

const {
  applyDefault,
  deepMerge,
  isObjectNotArray,
  getParserServices,
  nullThrows,
  NullThrowsReasons
} = utils.ESLintUtils;

function getESLintCoreRule(ruleId) {
  return jsRules.rules[ruleId];
}

exports.NullThrowsReasons = NullThrowsReasons;
exports.createRule = createRule;
exports.deepMerge = deepMerge;
exports.getESLintCoreRule = getESLintCoreRule;
exports.getStringLength = getStringLength;
exports.nullThrows = nullThrows;
