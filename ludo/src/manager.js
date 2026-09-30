'use strict';
/**
 * Gestionnaire de parties — indépendant de la plateforme.
 *
 * handle({ chatId, sender:{id,name}, isAdmin, cmd, args, io })
 *   cmd : 'ludo' | 'de' | 'pion'
 *   io  : { text(txt, mentions[]), image(buffer, caption, mentions[]) }   → à fournir par l'adaptateur
 */
const E = require('./engine');
const R = require('./render');
const T = require('./texts');
const B = require('./board');
const baseCfg = require('./config');

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const same = (a, b) => T.num(a) === T.num(b);
const isBotPlayer = (p) => !!(p && p.bot);
/** JIDs des vrais joueurs : le robot est affiché (@robot) mais jamais mentionné. */
const realIds = (state) => state.players.filter((p) => !p.bot).map((p) => p.id);
/** JID d'un robot : tag() affiche @robot, et le plugin filtre les mentions non numériques. */
const botJid = (n) => `robot${n > 1 ? n : ''}@s.whatsapp.net`;
const isBotTurn = (st) => !!(st && st.status === 'playing' && isBotPlayer(st.players[st.turn]));

class LudoManager {
  constructor(options = {}) {
    this.cfg = { ...baseCfg, ...options, rules: { ...baseCfg.rules, ...(options.rules || {}) } };
    this.rooms = new Map();   // chatId -> room
    this.queues = new Map();  // chatId -> Promise (exécution sérialisée par chat)
  }

  handle(ctx) {
    const prev = this.queues.get(ctx.chatId) || Promise.resolve();
    const run = prev.catch(() => {}).then(() => this._dispatch(ctx));
    this.queues.set(ctx.chatId, run);
    return run;
  }

  // ── Routage ───────────────────────────────────────────────────────────
  async _dispatch(ctx) {
    const { cmd, io } = ctx;
    const args = ctx.args || [];
    const room = this.rooms.get(ctx.chatId);
    if (room) room.io = io;

    if (cmd === 'de') return this._roll(room, ctx);
    if (cmd === 'pion') return this._move(room, ctx);

    const sub = norm(args[0]);
    switch (sub) {
      case '': case 'aide': case 'help': case 'menu': return io.text(T.help());
      case 'regles': case 'regle': case 'rules': return io.text(T.rules(this.cfg.rules));
      case 'creer': case 'create': case 'new': case 'nouveau': case 'open': return this._create(room, ctx);
      case 'solo': case 'bot': case 'robot': case 'ia': return this._solo(room, ctx);
      case 'rejoindre': case 'join': case 'rejoins': return this._join(room, ctx);
      case 'start': case 'demarrer': case 'commencer': case 'jouer': return this._start(room, ctx);
      case 'quitter': case 'leave': case 'abandon': return this._leave(room, ctx);
      case 'stop': case 'annuler': case 'fin': return this._stop(room, ctx);
      case 'pos': case 'position': case 'moi': case 'pions': return this._position(room, ctx);
      case 'plateau': case 'board': case 'etat': case 'status': return this._board(room, ctx);
      default: return io.text(T.help());
    }
  }

  // ── Salon ─────────────────────────────────────────────────────────────
  async _create(room, { chatId, sender, io }) {
    if (room) return io.text(T.alreadyRoom());
    const r = { chatId, status: 'lobby', hostId: sender.id, lobby: [{ id: sender.id, name: sender.name }], state: null, io, token: 0, timer: null, lobbyTimer: null };
    this.rooms.set(chatId, r);
    r.lobbyTimer = setTimeout(() => this._enqueue(chatId, async () => {
      const cur = this.rooms.get(chatId);
      if (cur === r && r.status === 'lobby') { this.rooms.delete(chatId); await r.io.text(T.lobbyExpired()); }
    }), this.cfg.lobbyTimeoutMs);
    r.lobbyTimer.unref?.();
    return io.text(T.lobbyOpen(r), [sender.id]);
  }

  // ── Mode solo : la partie démarre tout de suite contre le robot ───────
  // .ludo solo [2-4] → 1 humain + (n-1) robots, sans salon d'attente.
  async _solo(room, ctx) {
    const { chatId, sender, io, args } = ctx;
    if (room) return io.text(T.alreadyRoom());
    const solo = this.cfg.solo || {};
    const want = Math.min(Math.max(parseInt(String(args[1] || ''), 10) || 2, 2), this.cfg.maxPlayers);
    const lobby = [{ id: sender.id, name: sender.name }];
    for (let k = 1; k < want; k++) lobby.push({ id: botJid(k), name: solo.name || 'Robot', bot: true });

    const r = { chatId, status: 'playing', hostId: sender.id, lobby, state: null, io, token: 0, timer: null, lobbyTimer: null };
    this.rooms.set(chatId, r);
    r.state = E.createGame(lobby, this.cfg.rules);
    await io.text(T.soloStart(r.state), [sender.id]);
    return this._promptTurn(r, true);
  }

  async _join(room, { sender, io }) {
    if (!room) return io.text(T.noGame());
    if (room.status !== 'lobby') return io.text(T.gameRunning());
    if (room.lobby.some((p) => same(p.id, sender.id))) return io.text(T.alreadyIn());
    if (room.lobby.length >= this.cfg.maxPlayers) return io.text(T.lobbyFull());
    room.lobby.push({ id: sender.id, name: sender.name });
    return io.text(T.lobbyJoin(room, sender.id), room.lobby.map((p) => p.id));
  }

  async _start(room, ctx) {
    const { sender, isAdmin, io } = ctx;
    if (!room) return io.text(T.noGame());
    if (room.status !== 'lobby') return io.text(T.gameRunning());
    if (!same(sender.id, room.hostId) && !isAdmin) return io.text(T.hostOnly());
    if (room.lobby.length < this.cfg.minPlayers) return io.text(T.needPlayers());
    clearTimeout(room.lobbyTimer);
    room.status = 'playing';
    room.state = E.createGame(room.lobby, this.cfg.rules);
    const mentions = room.state.players.map((p) => p.id);
    await io.text(T.gameStart(room.state), mentions);
    await this._promptTurn(room, true);
  }

  async _leave(room, { sender, io }) {
    if (!room) return io.text(T.noGame());
    if (room.status === 'lobby') {
      const i = room.lobby.findIndex((p) => same(p.id, sender.id));
      if (i < 0) return io.text(T.notPlayer());
      const [p] = room.lobby.splice(i, 1);
      if (room.lobby.length === 0) { clearTimeout(room.lobbyTimer); this.rooms.delete(room.chatId); return io.text(T.stopped()); }
      if (same(p.id, room.hostId)) room.hostId = room.lobby[0].id;
      return io.text(`🚪 ${T.tag(p.id)} quitte le salon. 👑 Organisateur : ${T.tag(room.hostId)}`, [p.id, room.hostId]);
    }
    const idx = room.state.players.findIndex((p) => same(p.id, sender.id) && p.active);
    if (idx < 0) return io.text(T.notPlayer());
    const p = room.state.players[idx];
    await io.text(T.left(p), [p.id]);
    return this._afterRemoval(room, idx);
  }

  async _stop(room, { sender, isAdmin, io }) {
    if (!room) return io.text(T.noGame());
    if (!same(sender.id, room.hostId) && !isAdmin) return io.text(T.hostOnly());
    this._destroy(room);
    return io.text(T.stopped());
  }

  // ── Consultation ──────────────────────────────────────────────────────
  async _position(room, { sender, io }) {
    if (!room || room.status !== 'playing') return io.text(T.noGame());
    const st = room.state;
    const idx = st.players.findIndex((p) => same(p.id, sender.id) && p.active);
    if (idx < 0) return io.text(T.notPlayer());
    const p = st.players[idx];
    const img = R.renderBoard(st, { asPlayer: idx, dice: idx === st.turn ? st.dice : null, subtitle: 'Tes pions sont entourés en blanc' });
    return io.image(img, `${T.HEAD}\n📍 *Position de ${T.tag(p.id)}* (${T.col(p.color)})\n\n${T.positionsBlock(p, st.rules)}`, [p.id]);
  }

  async _board(room, { io }) {
    if (!room || room.status !== 'playing') return io.text(T.noGame());
    const st = room.state;
    const img = R.renderBoard(st, { title: `Tour ${st.turnNo}` });
    return io.image(img, `${T.HEAD}\n🗺️ *Plateau • tour ${st.turnNo}*\n\n${T.allPositions(st)}\n\n${T.yourTurn(st)}`, realIds(st));
  }

  // ── Jeu ───────────────────────────────────────────────────────────────
  _guard(room, sender, io, wantPhase) {
    if (!room || room.status !== 'playing') { io.text(T.noGame()); return null; }
    const st = room.state;
    const idx = st.players.findIndex((p) => same(p.id, sender.id) && p.active);
    if (idx < 0) { io.text(T.notPlayer()); return null; }
    if (idx !== st.turn) { io.text(T.notYourTurn(st), [st.players[st.turn].id]); return null; }
    if (st.phase !== wantPhase) { io.text(wantPhase === 'roll' ? T.mustMove() : T.mustRoll()); return null; }
    return idx;
  }

  async _roll(room, { sender, io }) {
    const idx = this._guard(room, sender, io, 'roll');
    if (idx === null) return;
    const st = room.state;
    st.players[idx].timeouts = 0;
    const res = E.roll(st);
    const auto = this.cfg.autoSingleMove && res.legal.length === 1;
    const image = R.renderBoard(st, { asPlayer: idx, dice: res.value, title: `Tour ${st.turnNo}`, subtitle: res.legal.length > 1 ? 'Choisis : .pion <n>' : '' });
    await io.image(image, T.rollCaption(st, res, auto), isBotPlayer(st.players[idx]) ? [] : [st.players[idx].id]);

    if (res.passed) return this._promptTurn(room, false, res.extra);
    if (auto) return this._applyMove(room, res.legal[0].pawn);
    this._arm(room);
  }

  async _move(room, { args, sender, io }) {
    const idx = this._guard(room, sender, io, 'move');
    if (idx === null) return;
    const st = room.state;
    const n = parseInt(String(args[0] || '').replace(/\D/g, ''), 10);
    if (!n || !st.legal.some((m) => m.pawn === n - 1)) return io.text(T.badPawn(st));
    st.players[idx].timeouts = 0;
    return this._applyMove(room, n - 1);
  }

  async _applyMove(room, pawn) {
    const st = room.state, io = room.io;
    const res = E.move(st, pawn);
    const text = T.moveResult(st, res);
    const mentions = realIds(st);

    if (res.ended) {
      this._clearTimer(room);
      await io.text(text, mentions);
      const img = R.renderBoard(st, { title: 'Partie terminée', showLegal: false });
      await io.image(img, T.podium(st), mentions);
      this.rooms.delete(room.chatId);
      return;
    }
    if (this.cfg.imageAfterMove) {
      await io.image(R.renderBoard(st, { asPlayer: res.player, dice: res.value, showLegal: false, title: `Tour ${st.turnNo}` }), text, mentions);
    } else {
      await io.text(text, mentions);
    }
    return this._promptTurn(room, false, res.extra);
  }

  // ── Tours, minuteur, abandons ─────────────────────────────────────────
  async _promptTurn(room, withBoard, extra = false) {
    const st = room.state;
    const mentions = isBotPlayer(st.players[st.turn]) ? [] : [st.players[st.turn].id];
    if (withBoard) {
      await room.io.image(R.renderBoard(st, { title: `Tour ${st.turnNo}` }), `${T.yourTurn(st)}\n\n🗺️ Plateau de départ.`, mentions);
    } else {
      await room.io.text(extra ? T.extraRoll(st) : T.yourTurn(st), mentions);
    }
    this._arm(room);
  }

  _clearTimer(room) {
    clearTimeout(room.timer); room.timer = null;
    clearTimeout(room.botTimer); room.botTimer = null;
    room.token++;
  }

  _arm(room) {
    this._clearTimer(room);
    const token = room.token;
    room.timer = setTimeout(() => this._enqueue(room.chatId, () => this._onTimeout(room, token)), this.cfg.turnTimeoutMs);
    room.timer.unref?.();
    if (isBotTurn(room.state)) this._scheduleBot(room, token);
  }

  /** Mode solo : le robot lance le dé puis joue son coup, après un court délai. */
  _scheduleBot(room, token) {
    if (room.botTimer) return;
    const delay = (this.cfg.solo && this.cfg.solo.delayMs) || 1200;
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      this._enqueue(room.chatId, () => {
        if (this.rooms.get(room.chatId) !== room || room.token !== token) return;
        return this._botTurn(room);
      });
    }, delay);
    room.botTimer.unref?.();
  }

  async _botTurn(room) {
    if (this.rooms.get(room.chatId) !== room) return;
    const st = room.state;
    if (!st || st.status !== 'playing' || !isBotTurn(st)) return;
    const p = st.players[st.turn];
    const sender = { id: p.id, name: p.name };
    const io = room.io;

    if (st.phase === 'roll') {
      await this._roll(room, { sender, io });
      if (this.rooms.get(room.chatId) !== room) return;
      const cur = room.state;
      // _roll a pu tout jouer seul (coup unique), passer le tour, ou laisser un choix
      if (!cur || cur.status !== 'playing' || !isBotTurn(cur) || cur.phase !== 'move') return;
      return this._move(room, { args: [String(E.bestMove(cur) + 1)], sender, io });
    }
    return this._move(room, { args: [String(E.bestMove(st) + 1)], sender, io });
  }

  async _onTimeout(room, token) {
    if (this.rooms.get(room.chatId) !== room || room.token !== token || room.status !== 'playing') return;
    const st = room.state, io = room.io;
    const idx = st.turn, p = st.players[idx];
    await io.text(T.timeout(p), [p.id]);
    if (p.timeouts + 1 >= this.cfg.maxTimeoutsBeforeKick) {
      await io.text(T.kicked(p), [p.id]);
      return this._afterRemoval(room, idx);
    }
    E.skipTurn(st);
    return this._promptTurn(room, false);
  }

  async _afterRemoval(room, idx) {
    const st = room.state, io = room.io;
    const wasTurn = st.turn === idx;
    const over = E.removePlayer(st, idx);
    if (over) {
      this._clearTimer(room);
      const mentions = realIds(st);
      await io.image(R.renderBoard(st, { title: 'Partie terminée', showLegal: false }), T.podium(st), mentions);
      this.rooms.delete(room.chatId);
      return;
    }
    if (wasTurn) return this._promptTurn(room, false);
  }

  _destroy(room) {
    clearTimeout(room.lobbyTimer); this._clearTimer(room);
    this.rooms.delete(room.chatId);
  }

  _enqueue(chatId, fn) {
    const prev = this.queues.get(chatId) || Promise.resolve();
    const run = prev.catch(() => {}).then(fn).catch((e) => console.error('[LUDO]', e));
    this.queues.set(chatId, run);
    return run;
  }
}

module.exports = { LudoManager };
