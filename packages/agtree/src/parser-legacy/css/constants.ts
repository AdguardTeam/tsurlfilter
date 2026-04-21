/**
 * @file Error messages for CSS token stream and balancer.
 */

export const END_OF_INPUT = 'end of input';

export const ERROR_MESSAGES = {
    EXPECTED_ANY_TOKEN_BUT_GOT: "Expected a token, but got '%s'",
    EXPECTED_TOKEN_BUT_GOT: "Expected '%s', but got '%s'",
    EXPECTED_TOKEN_WITH_BALANCE_BUT_GOT: "Expected '%s' with balance '%d', but got '%d'",
    EXPECTED_TOKEN_WITH_VALUE_BUT_GOT: "Expected '%s' with value '%s', but got '%s'",
};
