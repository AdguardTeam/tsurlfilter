import { redirects, Redirect } from '@adguard/scriptlets';
import { resourcesService } from './resources-service';

// TODO: Update Redirect export
// TODO: Store files in tswebextension?
const { Redirects } = redirects as any;
export interface RedirectsServiceInterface {
    start: () => void;

    createRedirectUrl: (title: string) => string | null;
}


export class RedirectsService implements RedirectsServiceInterface {
    redirects: any;

    public async start() {
        try {
            const rawYaml = await resourcesService.loadResource('redirects.yml');
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

        // TODO: Update Redirect Interface
        const redirectSource = this.redirects.getRedirect(title) as Redirect & { file: string };

        if (!redirectSource) {
            console.debug(`There is no redirect source with title: "${title}"`);
            return null;
        }

        return resourcesService.createResourceUrl(`redirects/${redirectSource.file}`);
    }
}

export const redirectsService = new RedirectsService();