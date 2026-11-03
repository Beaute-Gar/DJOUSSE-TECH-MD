'use strict';

const createChatCommand = require('./_chat-ai');

module.exports = createChatCommand(
  ['bard'],
  'Gemini AI',
  'Answer as a knowledgeable AI assistant',
);
