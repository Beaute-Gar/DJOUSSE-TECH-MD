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

const runLegacyBehavior = async (s, m, a, c) => { const greetings = [['🇬🇧 English','Hello!'],['🇪🇸 Spanish','¡Hola!'],['🇫🇷 French','Bonjour!'],['🇩🇪 German','Hallo!'],['🇮🇹 Italian','Ciao!'],['🇵🇹 Portuguese','Olá!'],['🇯🇵 Japanese','こんにちは (Konnichiwa)'],['🇨🇳 Chinese','你好 (Nǐ hǎo)'],['🇰🇷 Korean','안녕하세요 (Annyeonghaseyo)'],['🇷🇺 Russian','Привет (Privet)'],['🇸🇦 Arabic','مرحبا (Marhaba)'],['🇰🇪 Swahili','Habari! / Jambo!'],['🇮🇳 Hindi','नमस्ते (Namaste)'],['🇹🇷 Turkish','Merhaba!'],['🇹🇭 Thai','สวัสดี (Sawasdee)'],['🇻🇳 Vietnamese','Xin chào!'],['🇬🇷 Greek','Γειά σου (Yia sou)'],['🇳🇬 Yoruba','Bawo ni!'],['🇪🇹 Amharic','ሰላም (Selam)'],['🇿🇼 Shona','Mhoro!']]; c.reply(`👋 *Hello in 20 Languages*\n\n${greetings.map(([l,g])=>`${l}: ${g}`).join('\n')}`); };

// @legacy-order {"sourceFile":"05-outils/language-tools.js","sourceOrder":127,"definitionIndex":0,"entryOrder":342}
module.exports = {
  commands: ["greet","hi"],
  description: "Greet in multiple languages",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
