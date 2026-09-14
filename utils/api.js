const fetch = require('node-fetch');

const gptResponse = async (text) => {
  try {
    const res = await fetch('https://api.voidworks.xyz/api/gpt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text })
    });
    const data = await res.json();
    return data.result || data.response || 'Pas de réponse.';
  } catch (e) {
    return 'Erreur lors de la requête IA.';
  }
};

const imageFromText = async (prompt) => {
  try {
    const res = await fetch(`https://api.voidworks.xyz/api/stablediffusion?query=${encodeURIComponent(prompt)}`);
    const data = await res.json();
    return data.url || null;
  } catch (e) {
    return null;
  }
};

const getMeme = async () => {
  try {
    const res = await fetch('https://meme-api.com/gimme');
    const data = await res.json();
    return data.url;
  } catch (e) {
    return null;
  }
};

const getQuote = async () => {
  try {
    const res = await fetch('https://api.voidworks.xyz/api/quote');
    const data = await res.json();
    return data;
  } catch (e) {
    return null;
  }
};

const getJoke = async () => {
  try {
    const res = await fetch('https://v2.jokeapi.dev/joke/Any?safe-mode');
    const data = await res.json();
    if (data.type === 'single') return data.joke;
    return `${data.setup}\n${data.delivery}`;
  } catch (e) {
    return 'Pas de blague dispo là.';
  }
};

const translateText = async (text, to = 'fr') => {
  try {
    const res = await fetch(`https://api.voidworks.xyz/api/translate?query=${encodeURIComponent(text)}&target=${to}`);
    const data = await res.json();
    return data.result || data.translation || text;
  } catch (e) {
    return text;
  }
};

const getWeather = async (city) => {
  try {
    const res = await fetch(`https://api.voidworks.xyz/api/weather?query=${encodeURIComponent(city)}`);
    const data = await res.json();
    return data;
  } catch (e) {
    return null;
  }
};

const ssWeb = async (url) => {
  try {
    return `https://image.thum.io/get/width/1920/crop/1080/fullpage/${url}`;
  } catch (e) {
    return null;
  }
};

module.exports = { gptResponse, imageFromText, getMeme, getQuote, getJoke, translateText, getWeather, ssWeb };