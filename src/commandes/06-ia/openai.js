'use strict';

const createChatCommand = require('./_chat-ai');

module.exports = createChatCommand(
  ['openai'],
  'OpenAI',
  'Provide a detailed expert answer',
);
