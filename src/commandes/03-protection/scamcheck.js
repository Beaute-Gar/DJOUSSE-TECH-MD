// @legacy-order {"sourceFile":"03-protection/antiscam.js","sourceOrder":22,"definitionIndex":0,"entryOrder":80}
'use strict';

const style = require('../../config/style');

const scamPatterns = [
    ['Investment Fraud', [
        /double\s+your\s+(money|investment|cash|crypto)/i,
        /\d+[x×%]\s*(profit|return|roi|gains?)\s*(guaranteed|daily|weekly|monthly)?/i,
        /guaranteed\s+(returns?|profits?|income|investment)/i,
        /invest\s+(and|to)\s+(earn|make|get)\s+\d/i,
        /minimum\s+invest(ment)?\s+of?\s+[a-z]*\s*\d/i,
        /withdrawal\s+of\s+[a-z]*\s*\d+\s*(daily|weekly|per day)/i,
        /ponzi|pyramid\s+scheme/i,
        /send\s+(btc|eth|usdt|crypto|coins?|money)\s+(to|and\s+get)/i,
    ]],
    ['Fake Giveaway / Prize', [
        /you\s+(have|'ve|ve|hav)\s+(won|win|been\s+selected)/i,
        /congratulations.{0,40}(won|prize|winner|selected)/i,
        /claim\s+your\s+(prize|reward|gift|winnings?|free\s+iphone|cash)/i,
        /free\s+(iphone|airpods|laptop|car|cash|money|gift\s+card)/i,
        /click\s+(here|the\s+link)\s+to\s+(claim|collect|receive|win)/i,
        /\b(giveaway|give\s*away)\b.{0,30}(click|link|dm|text|whatsapp)/i,
        /send\s+(your\s+)?(details|info|number|address)\s+to\s+claim/i,
    ]],
    ['Phishing / Credential Theft', [
        /verify\s+your\s+(account|whatsapp|bank|mpesa|paypal|number)/i,
        /your\s+account\s+(will\s+be\s+)?(suspended|closed|disabled|banned)/i,
        /enter\s+your\s+(pin|password|otp|code|details)/i,
        /otp\s+(code\s+)?(for\s+verification|expired|invalid)/i,
        /bank\s+(details?|account\s+number)\s+(required|needed|send)/i,
        /log\s*in\s+to\s+(verify|confirm|update)\s+your/i,
    ]],
    ['Loan / Money Mule Scam', [
        /instant\s+loan.{0,30}(no\s+(credit|collateral|security)|apply\s+now)/i,
        /quick\s+(loan|cash)\s+(no\s+documents?|apply\s+now|within\s+\d+\s*(mins?|hours?))/i,
        /transfer\s+(money|funds?)\s+(for\s+me|on\s+my\s+behalf|to\s+this\s+account)/i,
        /i\s+will\s+pay\s+you\s+\d+(%|percent)\s+(commission|for\s+transferring)/i,
        /help\s+me\s+(transfer|move|send)\s+(money|funds?|cash)/i,
    ]],
    ['Crypto / Forex Scam', [
        /forex\s+(trading\s+)?(signal|mentor|expert|guaranteed|profit)/i,
        /crypto\s+(trading\s+)?(signal|mentor|expert|guaranteed|roi)/i,
        /bitcoin\s+(flip|doubler|multiplier|generator)/i,
        /(recover\s+lost\s+crypto|crypto\s+recovery\s+expert)/i,
        /trade\s+(with\s+)?(me|us|our\s+(team|expert))\s+(and\s+earn|for\s+guaranteed)/i,
        /\$\d+\s+(per\s+day|daily)\s+(trading|forex|crypto|signal)/i,
    ]],
    ['Fake Job Offer', [
        /earn\s+\$?\d+(,\d+)?\s+(per\s+(day|week|month)|daily|weekly)\s+(from\s+home|online|working)/i,
        /work\s+from\s+home.{0,40}earn\s+\$?\d+/i,
        /part[\s-]time\s+(job|work|earn).{0,30}(no\s+experience|anyone\s+can)/i,
        /whatsapp\s+(job|task|earn)\s+(daily|weekly|\$\d+)/i,
        /typing\s+job.{0,30}earn\s+\$?\d+/i,
        /data\s+entry.{0,40}no\s+(experience|skill|qualification)/i,
    ]],
];

function detectScam(text) {
    for (const [category, patterns] of scamPatterns) {
        if (patterns.some((pattern) => pattern.test(text))) return category;
    }
    return null;
}

module.exports = {
    commands: ['scamcheck', 'checkscam'],
    description: 'Check text against known scam patterns',
    permission: 'admin',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const text = args.join(' ');
        if (!text) {
            return ctx.reply(style.renderError([
                'Provide text to check.',
                'Example: `.scamcheck I will double your investment`',
            ]));
        }

        const category = detectScam(text);
        if (category) {
            return ctx.reply(style.renderError([
                '🚨 Scam detected!',
                `Category: ${category}`,
                'The provided text matches a known scam pattern.',
            ]));
        }

        return ctx.reply(style.renderSuccess([
            'No scam patterns detected.',
            'Text appears clean based on known patterns.',
        ]));
    },
};
