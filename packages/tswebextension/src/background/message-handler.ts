import browser from 'webextension-polyfill'

export interface MessageHandlerInterface {
    start: () => void;
    stop: () => void;
}

export class MessageHandler {
    constructor() {
        this.handleMessage = this.handleMessage.bind(this);
    }

    public start(): void {
        browser.runtime.onMessage.addListener(this.handleMessage)
    }

    public stop(): void {
        browser.runtime.onMessage.removeListener(this.handleMessage)
    }

    private handleMessage(message: unknown){
        console.log('handle message:', message)
    }
}

export const messageHandler = new MessageHandler();
