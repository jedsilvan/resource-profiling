const axios = require('axios');
const sizeOf = require('buffer-image-size');

exports.fetchImage = function (url) {
    return axios.get(url, { responseType: 'arraybuffer' })
        .then(function (response) {
            const headers = response.headers;
            const contentLength = headers['content-length'] * 0.001; // byte to kb
            const imageInfo = sizeOf(response.data);

            return {
                url,
                size: parseFloat(contentLength),
                ...imageInfo
            }
        })
        .catch(function (error) {
            console.log(error);
        });
};
