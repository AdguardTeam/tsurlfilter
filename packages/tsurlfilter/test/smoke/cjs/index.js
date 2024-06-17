const { DeclarativeFilterConverter, Filter } = require('@adguard/tsurlfilter/declarative-converter');

const main = async () => {
    const createFilter = (
        rules,
        filterId = 0,
    ) => {
        return new Filter(
            filterId,
            { getContent: async () => rules },
        );
    };

    const converter = new DeclarativeFilterConverter();
    const filter = createFilter(['']);
    const { ruleSet } = await converter.convertStaticRuleSet(filter);
    const declarativeRules = await ruleSet.getDeclarativeRules();
    console.assert(declarativeRules.length === 1, 'declarativeRules.length === 1');
    console.assert(declarativeRules[0].id === 1, 'declarativeRules[0].id === 1');
    console.assert(declarativeRules[0].action.type === 'block', 'declarativeRules[0].action.type === \'block\'');
    console.assert(declarativeRules[0].condition.urlFilter === '||example.org^', 'declarativeRules[0].condition.urlFilter === \'||example.org^\'');
    console.assert(declarativeRules[0].condition.isUrlFilterCaseSensitive === false, 'declarativeRules[0].condition.isUrlFilterCaseSensitive === false');
};

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


