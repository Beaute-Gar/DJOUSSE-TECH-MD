'use strict';
module.exports = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    { commands: ['musicfact', 'musicf'], description: 'Random music fact', permission: 'public', run: async (s, m, a, c) => { const facts = ['The world\'s longest concert lasted 453 hours.','Happy Birthday was copyrighted until 2015.','The Beatles couldn\'t read music.','Metallica is the only band to have played on all 7 continents.','A violin contains about 70 individual pieces of wood.','The most expensive instrument sold was a Stradivarius for $15.9 million.','Jimi Hendrix couldn\'t read music.','Mozart wrote his first symphony at age 8.','The longest song ever recorded is 13 hours long.','Finland has the most heavy metal bands per capita.','A piano has 230 strings.','Elvis never performed outside of North America.','The guitar is the world\'s most popular instrument.','Spotify pays artists $0.003-0.005 per stream.','The first music video on MTV was "Video Killed the Radio Star."']; c.reply(`🎵 *Music Fact*\n\n${facts[Math.floor(Math.random()*facts.length)]}`); }},
    null,
];
