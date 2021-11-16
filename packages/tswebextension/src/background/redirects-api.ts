import { redirects } from '@adguard/scriptlets';
import { resourcesApi } from './resources-api';

const { Redirects } = redirects as any;

export interface RedirectsApiInterface {
    start: () => void;

    createRedirectUrl: (title: string) => string | null;
}

export class RedirectsApi implements RedirectsApiInterface {
    redirects: any;

    public async start() {
        try {
            const rawYaml = await resourcesApi.loadResource('/war/redirects.yml');
            this.redirects = new Redirects(rawYaml);
        } catch (e){
            throw new Error((e as Error).message);
        }
   
    }

    public createRedirectUrl(title: string | null): string | null {
        if (!title) {
            return null;
        }

        if (!this.redirects){
            return null;
        }

        const redirectSource = this.redirects.getRedirect(title);

        if (!redirectSource) {
            console.debug(`There is no redirect source with title: "${title}"`);
            return null;
        }

        return resourcesApi.createResourceUrl(`/war/redirects/${redirectSource.file}`);
    }
}

export const redirectsApi = new RedirectsApi();