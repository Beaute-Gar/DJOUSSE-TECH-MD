'use strict';
const style = require('../../config/style');

const styledContext = (context) => new Proxy(context, {
  get(target, property, receiver) {
    if (property === 'reply') {
      return (message, ...options) => {
        const text = String(message);
        const render = text.startsWith('Usage:') || text.startsWith(String.fromCodePoint(0x274c)) || /^Invalid\b/.test(text) ? style.renderError : style.renderInfo;
        return target.reply(render([text]), ...options);
      };
    }
    return Reflect.get(target, property, receiver);
  },
});

const runLegacyBehavior = async (s, m, a, c) => { const terms = {slay:{def:'To do something exceptionally well',ex:'"She really slayed that presentation"'},bussin:{def:'Really good, especially food',ex:'"This pizza is bussin"'},cap:{def:'Lie / No cap = truth',ex:'"No cap, that was amazing"'},bet:{def:'Agreement, "okay" or "for sure"',ex:'"Wanna hang out?" "Bet."'},vibe:{def:'A mood or feeling',ex:'"This song is such a vibe"'},snatched:{def:'Looking really good',ex:'"Your outfit is snatched"'},ghosting:{def:'Suddenly cutting off communication',ex:'"He ghosted me after the date"'},lowkey:{def:'Secretly, somewhat, subtly',ex:'"I lowkey love that song"'},highkey:{def:'Openly, obviously',ex:'"I highkey need a vacation"'},sus:{def:'Suspicious',ex:'"That excuse is kinda sus"'},yeet:{def:'To throw with force',ex:'"He yeeted the ball across the field"'},fire:{def:'Amazing, excellent',ex:'"This beat is fire"'},flex:{def:'To show off',ex:'"Nice car, stop flexing"'},goat:{def:'Greatest Of All Time',ex:'"Messi is the GOAT"'},lit:{def:'Amazing, exciting',ex:'"The party was lit"'}}; const q = (a[0]||'').toLowerCase(); if (q && terms[q]) return c.reply(`🗣️ *${q.toUpperCase()}*\n\nMeaning: ${terms[q].def}\nExample: _${terms[q].ex}_`); const keys = Object.keys(terms); const random = keys[Math.floor(Math.random()*keys.length)]; c.reply(`🗣️ *Gen Z Slang: ${random.toUpperCase()}*\n\nMeaning: ${terms[random].def}\nExample: _${terms[random].ex}_\n\nLook up: .slang <word>`); };

// @legacy-order {"sourceFile":"05-outils/language-tools.js","sourceOrder":127,"definitionIndex":5,"entryOrder":347}
module.exports = {
  commands: ["slang","genz"],
  description: "Gen Z slang dictionary",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
