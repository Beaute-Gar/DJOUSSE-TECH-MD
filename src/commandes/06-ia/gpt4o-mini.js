'use strict';

const createChatCommand = require('./_chat-ai');

module.exports = createChatCommand(
  ['gpt4o-mini'],
  'GPT-4o Mini',
  'Be concise and helpful',
);
