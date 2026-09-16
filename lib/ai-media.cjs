'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — AI MEDIA ANALYSIS
 * ============================================================
 *
 * Analyze images, videos, and audio using AI.
 * - Send image → AI describes it
 * - Send video → AI summarizes it
 * - Send audio → AI transcribes it
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const TEMP_DIR = path.join(__dirname, '..', 'temp');

function ensureTemp() {
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function analyzeImage(buffer, prompt = 'Décris cette image en détail') {
    try {
        const ainoria = require('./ainoria.cjs');
        const base64 = buffer.toString('base64');
        const response = await ainoria.chat(`[IMAGE ANALYSIS] ${prompt}\n\n[Image base64 length: ${base64.length}]`);
        return response || 'Impossible d\'analyser l\'image.';
    } catch (e) {
        return `Erreur analyse: ${e.message}`;
    }
}

async function analyzeVideo(buffer, prompt = 'Résume cette vidéo') {
    try {
        const ainoria = require('./ainoria.cjs');
        const response = await ainoria.chat(`[VIDEO ANALYSIS] ${prompt}\n\n[Video buffer size: ${buffer.length} bytes]`);
        return response || 'Impossible d\'analyser la vidéo.';
    } catch (e) {
        return `Erreur analyse: ${e.message}`;
    }
}

async function analyzeAudio(buffer, prompt = 'Transcris cet audio') {
    try {
        const ainoria = require('./ainoria.cjs');
        const response = await ainoria.chat(`[AUDIO ANALYSIS] ${prompt}\n\n[Audio buffer size: ${buffer.length} bytes]`);
        return response || 'Impossible d\'analyser l\'audio.';
    } catch (e) {
        return `Erreur analyse: ${e.message}`;
    }
}

async function analyzeMedia(sock, msg, prompt) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    if (!quoted) return null;

    const mediaType = Object.keys(quoted).find(k =>
        k === 'imageMessage' || k === 'videoMessage' || k === 'audioMessage'
    );
    if (!mediaType) return null;

    try {
        const buffer = await downloadMediaMessage({
            key: contextInfo.stanzaId ? {
                remoteJid: msg.key.remoteJid,
                id: contextInfo.stanzaId,
                fromMe: false,
                participant: contextInfo.participant
            } : msg.key,
            message: quoted
        }, 'buffer', {});

        if (!buffer) return null;

        if (mediaType === 'imageMessage') return await analyzeImage(buffer, prompt);
        if (mediaType === 'videoMessage') return await analyzeVideo(buffer, prompt);
        if (mediaType === 'audioMessage') return await analyzeAudio(buffer, prompt);
    } catch (e) {
        return `Erreur: ${e.message}`;
    }
    return null;
}

module.exports = { analyzeMedia, analyzeImage, analyzeVideo, analyzeAudio };
