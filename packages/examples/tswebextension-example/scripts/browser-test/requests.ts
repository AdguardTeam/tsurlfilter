import axios from "axios";

import { baseUrl } from './config';

axios.defaults.baseURL = baseUrl;

export const loadRulesText = async (url: string) => {
    try {
        const res = await axios.get(url, {
            validateStatus: (status) => {
                return status === 200; // Resolve only if the status code is 200
            },
        });

        return res.data;
    } catch (e) {
        console.log(e.mesage);
        return null;
    }
}