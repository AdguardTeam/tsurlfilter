const axios = require("axios");

const { baseUrl } = require('./config');

axios.defaults.baseURL = baseUrl;

exports.loadRulesText = async (url) => {
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