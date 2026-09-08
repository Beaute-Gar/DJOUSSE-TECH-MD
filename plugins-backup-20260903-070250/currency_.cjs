const axios = require('axios');
const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

function formatNumber(n) {
    return new Intl.NumberFormat().format(n.toFixed(2));
}

function getFlagEmoji(code) {
    const points = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt());
    return String.fromCodePoint(...points);
}

const currencyToCountry = { USD: 'US', LKR: 'LK', EUR: 'EU', GBP: 'GB', JPY: 'JP', INR: 'IN', AUD: 'AU', CAD: 'CA', SGD: 'SG', CNY: 'CN' };

cmd({ pattern: 'convert', alias: ['currency', 'cur'], react: '💱', desc: 'Convert one currency to another or get current rate', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { args, reply }) => {
    try {
        if (!args.length || args[0] === 'help') {
            return reply(box('🧾 *CURRENCY CONVERTER*', [
                { label: 'Utilisation', value: '.convert <amount> <from> <to>' },
                { label: 'Exemple', value: '.convert 100 USD LKR' },
                { blank: true },
                { raw: '📉 *Current Rate:* .convert USD LKR' },
                { raw: '💡 *Supported:* USD, EUR, LKR, INR, JPY, GBP, etc.' },
            ]));
        }
        let amount = 1, from, to;
        if (args.length === 2) {
            [from, to] = args;
        } else if (args.length === 3) {
            [amount, from, to] = args;
            amount = parseFloat(amount);
            if (isNaN(amount)) return reply(box('❌ *MONTANT INVALIDE*', [
                { label: 'Erreur', value: 'Must be a number.' },
            ]));
        } else {
            return reply(box('❌ *COMMANDE INVALIDE*', [
                { raw: 'Type `.convert help` for usage.' },
            ]));
        }
        from = from.toUpperCase();
        to = to.toUpperCase();
        const res = await axios.get('https://open.er-api.com/v6/latest/' + from);
        const { rates, time_last_update_utc } = res.data;
        if (!rates[to]) return reply(box('❌ *CODE INVALIDE*', [
            { label: 'Erreur', value: 'Invalid target currency code!' },
        ]));
        const converted = amount * rates[to];
        const flagFrom = currencyToCountry[from] ? getFlagEmoji(currencyToCountry[from]) : '';
        const flagTo = currencyToCountry[to] ? getFlagEmoji(currencyToCountry[to]) : '';
        reply(box('💱 *CURRENCY CONVERSION*', [
            { label: '🔢 Amount', value: formatNumber(amount) + ' ' + flagFrom + ' *' + from + '*' },
            { label: '📤 Converted', value: formatNumber(converted) + ' ' + flagTo + ' *' + to + '*' },
            { blank: true },
            { label: '🕰️ Rate as of', value: truncate(time_last_update_utc, 40) },
        ]));
    } catch (e) {
        console.error(e);
        reply(box('❌ *ERREUR*', [
            { label: 'Erreur', value: 'Error fetching rates. Please check your internet or currency codes.' },
        ]));
    }
});
