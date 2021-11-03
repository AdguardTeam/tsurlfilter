import browser from 'webextension-polyfill';

export interface MessagesApiInterface {
    start: () => void;
    stop: () => void;
    sendMessage: (tabId: number, message: unknown) => void;
}

export class MessagesApi {

    constructor() {
        this.handleMessage = this.handleMessage.bind(this);
    }

    public start(): void {
        browser.runtime.onMessage.addListener(this.handleMessage);
    }

    public stop(): void {
        browser.runtime.onMessage.removeListener(this.handleMessage);
    }

    public sendMessage(tabId: number, message: unknown){
        browser.tabs.sendMessage(tabId, message);
    }

    private handleMessage(message: unknown){
        console.log('handle message:', message);
    }
}

export const messagesApi = new MessagesApi();
