const { cmd } = require('../command.cjs');
const math = require('mathjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

cmd({ pattern: 'calc', alias: ['calculate', 'math'], react: '🧮', desc: 'Evaluate math expressions (supports sin, sqrt, log, etc.)', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { q, reply }) => {
    try {
        if (!q) return reply(box('🧮 *CALCULATRICE*', [
            { label: 'Utilisation', value: '.calc <expression>' },
            { label: 'Exemple', value: '.calc 5 + 3' },
            { blank: true },
            { raw: '*Exemples :*' },
            { raw: '.calc sqrt(25)' },
            { raw: '.calc sin(30 deg)' },
            { raw: '.calc 3^3 + log(100)' },
        ]));
        const expr = q.replace(/(\d+)\s*deg/g, '($1 deg)').replace(/π/g, 'pi').trim();
        const scope = { deg: math.unit('1 deg'), pi: math['pi'], e: math['e'] };
        let result;
        try {
            result = math.evaluate(expr, scope);
            if (typeof result === 'object' && result.format) result = result.toString();
        } catch (e) {
            return reply(box('❌ *EXPRESSION INVALIDE*', [
                { raw: '```' + e.message + '```' },
            ]));
        }
        reply(box('🧮 *CALCULATRICE*', [
            { label: 'Expression', value: truncate(q, 60) },
            { label: 'Résultat', value: truncate(String(result), 60) },
        ]));
    } catch (e) {
        console.error(e);
        reply(box('❌ *ERREUR INATTENDUE*', [
            { raw: '```' + e.message + '```' },
        ]));
    }
});
