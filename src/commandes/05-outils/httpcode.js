// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":7,"entryOrder":139}
'use strict';

const style = require('../../config/style');

const statusCodes = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

module.exports = {
  commands: ['httpcode', 'http'],
  description: 'HTTP status codes',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const code = args[0];
    if (!code) {
      return ctx.reply(style.renderError(['Usage: .http <code>', 'Example: .http 404']));
    }

    return ctx.reply(style.renderInfo([`🌐 HTTP ${code}\n\n${statusCodes[code] || 'Unknown status code'}`]));
  },
};
