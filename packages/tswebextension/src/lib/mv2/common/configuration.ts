import { z } from 'zod';
import { baseConfigurationValidator } from '../../common/configuration';

const manifestV2configurationValidator = z.object({
    /**
     * Specifies filter lists that will be used to filter content.
     * filterId should uniquely identify the filter so that the API user
     * may match it with the source lists in the filtering log callbacks.
     * content is a string with the full filter list content. The API will
     * parse it into a list of individual rules.
     */
    filters: z.object({
        filterId: z.number(),
        content: z.string(),
    }).array(),
}).strict();

export const configurationValidator = baseConfigurationValidator.merge(manifestV2configurationValidator);

export type Configuration = z.infer<typeof configurationValidator>;
