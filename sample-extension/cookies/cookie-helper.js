/* eslint-disable no-console, no-undef */

/**
 * Filters request cookie header
 *
 * @param headers
 * @param cookieRules
 * @return {null}
 */
export const processRequestHeaders = (headers, cookieRules) => {
    console.log('Processing request cookies');

    console.log(headers);
    console.log(cookieRules);

    // TODO: Modify cookie header

    return null;
};

/**
 * Filters response cookie headers
 *
 * @param headers
 * @param cookieRules
 * @return {null}
 */
export const processResponseHeaders = (headers, cookieRules) => {
    console.log('Processing response cookies');

    console.log(headers);
    console.log(cookieRules);

    // TODO: Modify cookie header

    return null;
};
