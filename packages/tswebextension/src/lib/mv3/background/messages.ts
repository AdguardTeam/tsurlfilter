import { z as zod } from 'zod';

import {
    messageValidator as commonMessageValidator,
    getCssPayloadValidator,
    MessageType as CommonMessageType,
} from '../../common';

enum ExtendedMV3MessageType {
    GetCollectedLog = 'GET_COLLECTED_LOG',
}

export { CommonMessageType, ExtendedMV3MessageType };

export const messageMV3Validator = commonMessageValidator.extend({
    type: zod.nativeEnum(CommonMessageType).or(zod.nativeEnum(ExtendedMV3MessageType)),
});

export type MessageMV3 = zod.infer<typeof messageMV3Validator>;

export const getCookieRulesPayloadValidator = zod.object({
    url: zod.string(),
    referrer: zod.string(),
}).strict();

export type GetCssPayload = zod.infer<typeof getCssPayloadValidator>;
