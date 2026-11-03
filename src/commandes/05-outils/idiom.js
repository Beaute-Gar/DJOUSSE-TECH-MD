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

const runLegacyBehavior = async (s, m, a, c) => { const idioms = [{phrase:'Break the ice',meaning:'To initiate a conversation in a social setting'},{phrase:'Hit the nail on the head',meaning:'To describe exactly what is causing a situation'},{phrase:'Piece of cake',meaning:'Something very easy'},{phrase:'Once in a blue moon',meaning:'Very rarely'},{phrase:'Spill the beans',meaning:'To reveal a secret'},{phrase:'Bite the bullet',meaning:'To endure a painful situation bravely'},{phrase:'Burning the midnight oil',meaning:'Working late into the night'},{phrase:'Cost an arm and a leg',meaning:'Very expensive'},{phrase:'Let the cat out of the bag',meaning:'To accidentally reveal a secret'},{phrase:'Kill two birds with one stone',meaning:'To accomplish two things with one action'},{phrase:'Under the weather',meaning:'Feeling ill or sick'},{phrase:'A blessing in disguise',meaning:'Something that seems bad but turns out good'},{phrase:'The best of both worlds',meaning:'Having advantages of two different things'},{phrase:'Speak of the devil',meaning:'When the person you\'re talking about appears'},{phrase:'Actions speak louder than words',meaning:'What you do matters more than what you say'}]; const i = idioms[Math.floor(Math.random()*idioms.length)]; c.reply(`📖 *English Idiom*\n\n"${i.phrase}"\n\nMeaning: _${i.meaning}_`); };

// @legacy-order {"sourceFile":"05-outils/language-tools.js","sourceOrder":127,"definitionIndex":6,"entryOrder":348}
module.exports = {
  commands: ["idiom","englishidiom"],
  description: "English idiom with meaning",
  permission: "public",
  run: (sock, message, args, context) => runLegacyBehavior(sock, message, args, styledContext(context)),
};
