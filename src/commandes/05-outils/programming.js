// @legacy-order {"sourceFile":"05-outils/info-lookup.js","sourceOrder":119,"definitionIndex":3,"entryOrder":333}
'use strict';

const style = require('../../config/style');

const LANGUAGES = Object.freeze({
  javascript: { year: 1995, creator: 'Brendan Eich', type: 'Dynamic, Interpreted', use: 'Web, Server, Mobile, Desktop' },
  python: { year: 1991, creator: 'Guido van Rossum', type: 'Dynamic, Interpreted', use: 'AI/ML, Data Science, Web, Automation' },
  java: { year: 1995, creator: 'James Gosling', type: 'Static, Compiled', use: 'Enterprise, Android, Web, Backend' },
  csharp: { year: 2000, creator: 'Microsoft', type: 'Static, Compiled', use: 'Windows, Games (Unity), Web, Enterprise' },
  rust: { year: 2010, creator: 'Graydon Hoare (Mozilla)', type: 'Static, Compiled', use: 'Systems, WebAssembly, Embedded' },
  go: { year: 2009, creator: 'Google', type: 'Static, Compiled', use: 'Cloud, Microservices, CLI tools' },
  swift: { year: 2014, creator: 'Apple', type: 'Static, Compiled', use: 'iOS, macOS, Server-side' },
  kotlin: { year: 2011, creator: 'JetBrains', type: 'Static, Compiled', use: 'Android, Server-side, Multiplatform' },
  typescript: { year: 2012, creator: 'Microsoft', type: 'Static (transpiled)', use: 'Web, Server, Full-stack' },
  php: { year: 1995, creator: 'Rasmus Lerdorf', type: 'Dynamic, Interpreted', use: 'Web, CMS (WordPress), Server' },
});

module.exports = {
  commands: ['programming', 'lang'],
  description: 'Programming language info',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const query = (args[0] || '').toLowerCase().replace(/[#\+\s]/g, '');
    const language = LANGUAGES[query];
    if (!language) {
      return ctx.reply(style.renderError([
        `Usage: .lang <language>\nLanguages: ${Object.keys(LANGUAGES).join(', ')}`,
      ]));
    }

    return ctx.reply(style.renderInfo([
      query.charAt(0).toUpperCase() + query.slice(1),
      '',
      `Created: ${language.year}`,
      `Creator: ${language.creator}`,
      `Type: ${language.type}`,
      `Used for: ${language.use}`,
    ]));
  },
};
