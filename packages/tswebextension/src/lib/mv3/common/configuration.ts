import { z } from 'zod';

import { baseConfigurationValidator } from '../../common/configuration';

const manifestV3configurationValidator = z.object({
    /**
     * Specifies filter lists that will be used to filter content.
     * id in filters array should uniquely identify the filter so that the API user
     * may match it with the source lists in the filtering log callbacks.
     */
    filters: z.number().array(),
}).strict();

export const configurationValidator = baseConfigurationValidator.merge(manifestV3configurationValidator);

export type Configuration = z.infer<typeof configurationValidator>;
