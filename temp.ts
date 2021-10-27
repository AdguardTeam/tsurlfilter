interface Base {
    requestId: string;
    url: string;
    method: string;
    frameId: number;
    parentFrameId: number;
    incognito?: boolean;
    cookieStoreId?: string;
    originUrl?: string;
    documentUrl?: string;
    tabId: number;
    type: ResourceType;
    timeStamp: number;
    thirdParty: boolean;
    initiator?: string;
    urlClassification?: UrlClassification;
}

interface OnBeforeRequestDetailsType {
    requestBody?: OnBeforeRequestDetailsTypeRequestBodyType;
}

interface OnBeforeSendHeadersDetailsType {
    requestHeaders?: HttpHeaders;
}

interface OnSendHeadersDetailsType {
    requestHeaders?: HttpHeaders;
}

interface OnHeadersReceivedDetailsType {
    statusLine: string;
    responseHeaders?: HttpHeaders;
    statusCode: number;
}

interface OnAuthRequiredDetailsType {
    scheme: string;
    realm?: string;
    challenger: OnAuthRequiredDetailsTypeChallengerType;
    isProxy: boolean;
    responseHeaders?: HttpHeaders;
    statusLine: string;
    statusCode: number;
}

interface OnResponseStartedDetailsType {
    ip?: string;
    fromCache: boolean;
    statusCode: number;
    responseHeaders?: HttpHeaders;
    statusLine: string;
}

interface OnBeforeRedirectDetailsType {
    ip?: string;
    fromCache: boolean;
    statusCode: number;
    redirectUrl: string;
    responseHeaders?: HttpHeaders;
    statusLine: string;
}

interface OnCompletedDetailsType {
    ip?: string;
    fromCache: boolean;
    statusCode: number;
    responseHeaders?: HttpHeaders;
    statusLine: string;
    urlClassification: UrlClassification;
    requestSize: number;
    responseSize: number;
}

interface OnErrorOccurredDetailsType {
    ip?: string;
    fromCache: boolean;
    error: string;
}
