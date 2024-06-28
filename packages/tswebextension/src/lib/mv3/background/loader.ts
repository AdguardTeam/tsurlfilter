const getContent = async (url: string): Promise<string> => {
    const file = await fetch(url);
    return file.text();
};

export const loadFileText = ((): (url: string) => Promise<string> => {
    const map: { [key: string]: Promise<string> } = {};

    const loadText = async (url: string): Promise<string> => {
        if (!map[url]) {
            map[url] = getContent(url);
        }

        return map[url];
    };

    return loadText;
})();
