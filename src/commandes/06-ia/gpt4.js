'use strict';

const createChatCommand = require('./_chat-ai');

module.exports = createChatCommand(
  ['gpt4', 'gpt-4'],
  'GPT-4',
  'Provide a detailed expert answer',
);
