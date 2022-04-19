export default function isHttpOrWsRequest(url: string) {
    return url.indexOf('http') === 0 || url.indexOf('ws') === 0;
}
