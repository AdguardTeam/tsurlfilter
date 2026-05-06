/**
 * @file
 * This file contains validation schemas and inferred types for message data.
 */
import { z } from 'zod';

import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { MESSAGE_HANDLER_NAME, MessageType } from './message-constants';

/**
 * Message DTO validation schema.
 */
export const messageValidator = z.object({
    handlerName: z.literal(MESSAGE_HANDLER_NAME),
    type: z.nativeEnum(MessageType),
    payload: z.unknown(),
}).strict();

/**
 * Message DTO type.
 */
export type Message = z.infer<typeof messageValidator>;

/**
 * {@link MessageType.ProcessShouldCollapse} Message payload validation schema.
 */
export const processShouldCollapsePayloadValidator = z.object({
    elementUrl: z.string(),
    documentUrl: z.string(),
    requestType: z.nativeEnum(RequestType),
}).strict();

/**
 * {@link MessageType.ProcessShouldCollapse} Message payload type.
 */
export type ProcessShouldCollapsePayload = z.infer<typeof processShouldCollapsePayloadValidator>;

/**
 * {@link MessageType.GetCosmeticData} Message payload validation schema.
 */
export const getExtendedCssPayloadValidator = z.object({
    documentUrl: z.string(),
}).strict();

/**
 * {@link MessageType.GetCosmeticData} Message payload type.
 */
export type GetExtendedCssPayloadValidator = z.infer<typeof getExtendedCssPayloadValidator>;

/**
 * {@link MessageType.GetCosmeticData} Message payload validation schema.
 */
export const getCosmeticDataPayloadValidator = z.object({
    documentUrl: z.string(),
}).strict();

/**
 * {@link MessageType.GetCosmeticData} Message payload type.
 */
export type GetCssPayloadValidator = z.infer<typeof getCosmeticDataPayloadValidator>;

/**
 * {@link MessageType.GetCookieRules} Message payload validation schema.
 */
export const getCookieRulesPayloadValidator = z.object({
    documentUrl: z.string(),
}).strict();

/**
 * {@link MessageType.GetCookieRules} Message payload type.
 */
export type GetCookieRulesPayloadValidator = z.infer<typeof getCookieRulesPayloadValidator>;

/**
 * {@link MessageType.SaveCookieLogEvent} Message payload validation schema.
 */
export const getSaveCookieLogEventPayloadValidator = z.object({
    cookieName: z.string(),
    cookieDomain: z.string(),
    cookieValue: z.string(),
    filterId: z.number(),
    ruleIndex: z.number(),
    thirdParty: z.boolean(),
    isAllowlist: z.boolean(),
    isImportant: z.boolean(),
    isDocumentLevel: z.boolean(),
    isCsp: z.boolean(),
    isCookie: z.boolean(),
    advancedModifier: z.string().nullable(),
}).strict();

/**
 * {@link MessageType.SaveCookieLogEvent} Message payload type.
 */
export type GetSaveCookieLogEventPayloadValidator = z.infer<typeof getSaveCookieLogEventPayloadValidator>;

/**
 * {@link MessageType.InitAssistant} Message payload validation schema.
 */
export const getAssistantCreateRulePayloadValidator = z.object({
    ruleText: z.string(),
}).strict();

/**
 * {@link MessageType.InitAssistant} Message payload type.
 */
export type GetAssistantCreateRulePayloadValidator = z.infer<typeof getAssistantCreateRulePayloadValidator>;

/**
 * Serialized representation of a single $removeparam rule.
 */
const removeParamDescriptorValidator = z.object({
    value: z.string(),
    isAllowlist: z.boolean(),
    isImportant: z.boolean(),
    filterId: z.number(),
    ruleIndex: z.number(),
    ruleText: z.string(),
    advancedModifier: z.string().nullable(),
}).strict();

/**
 * Serialized representation of a single $removeparam rule.
 */
export type RemoveParamDescriptor = z.infer<typeof removeParamDescriptorValidator>;

/**
 * Applied descriptor for log reporting (subset of RemoveParamDescriptor).
 *
 * Uses `.passthrough()` to allow extra internal fields (e.g. `valueRegExp`,
 * `isNegated`) sent by the main-world script without failing validation.
 */
export const appliedRemoveParamDescriptorValidator = removeParamDescriptorValidator
    .omit({ value: true })
    .passthrough();

/**
 * {@link MessageType.LogRemoveParamEvent} Message payload validation schema.
 */
export const logRemoveParamEventPayloadValidator = z.object({
    url: z.string(),
    appliedDescriptors: z.array(appliedRemoveParamDescriptorValidator),
}).strict();

/**
 * {@link MessageType.LogRemoveParamEvent} Message payload type.
 */
export type LogRemoveParamEventPayload = z.infer<typeof logRemoveParamEventPayloadValidator>;
