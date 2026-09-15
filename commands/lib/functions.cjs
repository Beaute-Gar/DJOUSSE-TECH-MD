module.exports = {
  fetchJson: async (url) => {
    const r = await fetch(url);
    return r.json();
  },
  getBuffer: async (url) => {
    const r = await fetch(url);
    return Buffer.from(await r.arrayBuffer());
  },
  getGroupAdmins: (participants) => participants?.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id) || []
};
