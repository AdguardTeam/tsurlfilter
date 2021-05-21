import fs from 'fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as TSUrlFilter from '@adguard/tsurlfilter';

const PATH_RULES = './extension/filters/static.txt';
const PATH_JSON = './extension/filters/declarative/rules.json';

/**
 * Compiles rules to declarative json
 * Actually for each ruleset entry in manifest's declarative_net_request:
 *
 * "declarative_net_request": {
 *   "rule_resources": [{
 *     "id": "ruleset_1",
 *     "enabled": true,
 *     "path": "filters/declarative/rules.json"
 *   }]
 * }
 *
 * we should find corresponding text file in resources, and then convert and save json to path specified in the manifest
 */
const precompileRules = () => {
    const converter = new TSUrlFilter.DeclarativeConverter();

    const data = fs.readFileSync(PATH_RULES, { encoding: 'utf-8' });

    // Note: match listId with ruleset "id" in manifest
    const list = new TSUrlFilter.StringRuleList(1, data, false);

    const result = converter.convert(list);

    fs.writeFileSync(PATH_JSON, JSON.stringify(result, null, '\t'));
};

precompileRules();
