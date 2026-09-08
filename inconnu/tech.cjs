const axios = require('axios');

async function fetchCoupleDP() {
  try {
    const res = await axios.get('https://api.lolhuman.xyz/api/couplepp?apikey=ubed24062', { timeout: 10000 });
    if (res.data?.result) {
      return { male: res.data.result.male, female: res.data.result.female };
    }
  } catch (e) {
    console.error('fetchCoupleDP error:', e.message);
  }
  return {
    male: 'https://files.catbox.moe/e1k73u.jpg',
    female: 'https://files.catbox.moe/e1k73u.jpg'
  };
}

module.exports = { fetchCoupleDP };
module.exports.default = { fetchCoupleDP };
