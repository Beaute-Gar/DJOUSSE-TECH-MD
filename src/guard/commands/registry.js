'use strict';
const commands = new Map();

/** cmd({ name, aliases, desc, group=true, admin=false, botAdmin=false, owner=false, run(ctx) }) */
function cmd(def) {
  const d = { group: true, admin: false, botAdmin: false, owner: false, aliases: [], ...def };
  commands.set(d.name, d);
  for (const a of d.aliases) commands.set(a, d);
  return d;
}
const get = (name) => commands.get(name);
const all = () => [...new Set(commands.values())];

module.exports = { cmd, get, all };
