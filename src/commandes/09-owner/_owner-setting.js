'use strict';

const config = require('../_partage/config');
const { renderError, renderInfo } = require('../../config/style');

module.exports = function createOwnerSetting({ command, description, usage, run }) {
  const register = ({ cmd }) => {
    cmd(command, [], {
      cat: 9,
      desc: description,
      usage,
      owner: true,
      group: true,
      private: true,
    }, async (ctx) => {
      const result = await run(ctx, config);
      return ctx.reply((result.error ? renderError : renderInfo)(result.lines));
    });
  };

  register.maison = true;
  return register;
};
