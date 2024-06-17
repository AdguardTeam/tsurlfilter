// This module will be manual installed via test.sh script.
// @ts-ignore
import * as TSUrlFilter from '@adguard/tsurlfilter';

const background = (): void => {
    console.log(TSUrlFilter);
};

export { background };
