import { z } from 'zod';
import { RequestType } from '@adguard/tsurlfilter';

export enum MessageType {
    PROCESS_SHOULD_COLLAPSE = 'PROCESS_SHOULD_COLLAPSE',
    GET_EXTENDED_CSS = 'GET_EXTENDED_CSS',
    GET_COOKIE_RULES = 'GET_COOKIE_RULES',
    SAVE_COOKIE_LOG_EVENT = 'SAVE_COOKIE_LOG_EVENT',
}


export const messageValidator = z.object({
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


export const  getExtendedCssPayloadValidator = z.object({
    documentUrl: z.string(),
}).strict();

export type GetExtendedCssPayloadValidator = z.infer<typeof getExtendedCssPayloadValidator>;

export const  getCookieRulesPayloadValidator = z.object({
    documentUrl: z.string(),
}).strict();

export type GetCookieRulesPayloadValidator = z.infer<typeof getCookieRulesPayloadValidator>;

export const  getSaveCookieLogEventPayloadValidator = z.object({
    cookieName: z.string(),
    cookieDomain: z.string(),
    cookieValue: z.string(),
    ruleText: z.string(),
    filterId: z.number(),
    thirdParty: z.boolean(),
}).strict();

export type GetSaveCookieLogEventPayloadValidator = z.infer<typeof getSaveCookieLogEventPayloadValidator>;
