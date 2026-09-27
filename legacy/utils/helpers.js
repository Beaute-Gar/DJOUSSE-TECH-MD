const fs = require('fs');
const path = require('path');
const { fromBuffer } = require('file-type');
const fetch = require('node-fetch');

const downloadMedia = async (msg, sock) => {
  try {
    const type = Object.keys(msg.message || {})[0];
    if (!type) return null;
    
    const stream = await sock.downloadMediaMessage(msg, 'buffer');
    return stream;
  } catch (e) {
    return null;
  }
};

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m}m${s}s`;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const parseMentions = (text) => {
  if (!text) return [];
  const mentionRegex = /@(\d{5,16})/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1] + '@s.whatsapp.net');
  }
  return mentions;
};

const uploadFile = async (buffer) => {
  try {
    const { ext } = await fromBuffer(buffer) || { ext: 'bin' };
    const form = new FormData();
    form.append('file', buffer, `file.${ext}`);
    
    const res = await fetch('https://cdn.szenn.xyz/api/upload', {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    return data.url;
  } catch (e) {
    return null;
  }
};

const extractUrl = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

const isUrl = (text) => {
  if (!text) return false;
  return /(https?:\/\/[^\s]+)/gi.test(text);
};

const runtime = (seconds) => {
  seconds = Number(seconds);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor(seconds % 86400 / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  
  return parts.join(' ');
};

module.exports = {
  downloadMedia,
  formatDuration,
  formatSize,
  sleep,
  parseMentions,
  uploadFile,
  extractUrl,
  isUrl,
  runtime
};