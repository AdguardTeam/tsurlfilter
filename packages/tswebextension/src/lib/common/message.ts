import { z } from 'zod';
import { RequestType } from '@adguard/tsurlfilter';

import { MESSAGE_HANDLER_NAME, MessageType } from './message-constants';

export const messageValidator = z.object({
    handlerName: z.literal(MESSAGE_HANDLER_NAME),
    type: z.nativeEnum(MessageType),
    payload: z.unknown(),
}).strict();

export type Message = z.infer<typeof messageValidator>;

export const processShouldCollapsePayloadValidator = z.object({
    elementUrl: z.string(),
    documentUrl: z.string(),
    requestType: z.nativeEnum(RequestType),
}).strict();

export type ProcessShouldCollapsePayload = z.infer<typeof processShouldCollapsePayloadValidator>;

export const getExtendedCssPayloadValidator = z.object({
    documentUrl: z.string(),
}).strict();

export type GetExtendedCssPayloadValidator = z.infer<typeof getExtendedCssPayloadValidator>;

export const getCssPayloadValidator = z.object({
    url: z.string(),
}).strict();

export type GetCssPayloadValidator = z.infer<typeof getCssPayloadValidator>;

export const getCookieRulesPayloadValidator = z.object({
    documentUrl: z.string(),
}).strict();

export type GetCookieRulesPayloadValidator = z.infer<typeof getCookieRulesPayloadValidator>;

export const getSaveCookieLogEventPayloadValidator = z.object({
    cookieName: z.string(),
    cookieDomain: z.string(),
    cookieValue: z.string(),
    ruleText: z.string(),
    filterId: z.number(),
    thirdParty: z.boolean(),
}).strict();

export type GetSaveCookieLogEventPayloadValidator = z.infer<typeof getSaveCookieLogEventPayloadValidator>;

export const getAssistantCreateRulePayloadValidator = z.object({
    ruleText: z.string(),
}).strict();

export type GetAssistantCreateRulePayloadValidator = z.infer<typeof getAssistantCreateRulePayloadValidator>;
