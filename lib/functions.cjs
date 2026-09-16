const fs = require('fs');
const axios = require('axios');

const getBuffer = async (url, options) => {
    try {
        options = options || {};
        const res = await axios({ method: 'get', url, headers: { 'DNT': 1, 'Upgrade-Insecure-Request': 1 }, ...options, responseType: 'arraybuffer' });
        return res.data;
    } catch { return null; }
};

const getGroupAdmins = (participants) => {
    const admins = [];
    for (let p of participants) if (p.admin !== null) admins.push(p.id);
    return admins;
};

const getRandom = (ext) => `${Math.floor(Math.random() * 10000)}${ext}`;

const h2k = (eco) => {
    const lyrik = ['', 'K', 'M', 'B', 'T', 'P', 'E'];
    const ma = Math.floor(Math.log10(Math.abs(eco)) / 3);
    if (ma === 0) return eco.toString();
    const scale = Math.pow(10, ma * 3);
    const scaled = eco / scale;
    return scaled.toFixed(1).replace(/\.0$/, '') + lyrik[ma];
};

const isUrl = (url) => url.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%.+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%+.~#?&/=]*)/);

const Json = (string) => JSON.stringify(string, null, 2);

const runtime = (seconds) => {
    seconds = Math.floor(seconds);
    const d = Math.floor(seconds / (24 * 60 * 60));
    seconds %= 24 * 60 * 60;
    const h = Math.floor(seconds / (60 * 60));
    seconds %= 60 * 60;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, options) => {
    try {
        options = options || {};
        const res = await axios({ method: 'GET', url, headers: { 'User-Agent': 'Mozilla/5.0' }, ...options });
        return res.data;
    } catch { return null; }
};

module.exports = { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson };
