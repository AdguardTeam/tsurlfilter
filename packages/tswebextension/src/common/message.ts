import { z } from 'zod';
import { RequestType } from '@adguard/tsurlfilter';

export enum MessageType {
    PROCESS_SHOULD_COLLAPSE = 'PROCESS_SHOULD_COLLAPSE',
    GET_EXTENDED_CSS = 'GET_EXTENDED_CSS',
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
