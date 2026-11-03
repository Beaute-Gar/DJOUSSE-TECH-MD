'use strict';

const createChatCommand = require('./_chat-ai');

module.exports = createChatCommand(
  ['gpt4o', 'gpt-4o'],
  'GPT-4o',
  'Provide a detailed expert answer',
);
