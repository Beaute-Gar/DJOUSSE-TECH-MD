# AUDIT-REPAIR-REPORT.md — DJOUSSE TECH MD

**Date:** 2026-09-16
**Commit:** `2e71606` (fix: repair command dispatcher)
**Scope:** handler.js, command.cjs, diagnostic.js (×2), developer.js (new)

---

## Bugs Diagnosed & Fixed

### 1. `.heure` / `.time` — "Cannot destructure property 'q' of 'undefined'"

**Root cause:** `cmd()` wrapper called `handler(sock, msg, {args,...ctx})` with **3 args**. KnightBot-style handlers expect **4**: `(conn, m, commands, { q, reply })`. The 4th arg was `undefined`.

**Fix:** `commands/command.cjs` line 48-50 — now passes `handler(sock, msg, args, ctx)` with `ctx.q = args.join(' ')`.

### 2. `.menu` — "Cannot read properties of undefined (reading 'split')"

**Root cause:** `menu.js` is a `module.exports` plugin. It accessed `msg.sender.split(...)` but `msg` is the raw Baileys object — no `.sender` property. The handler passed `sender` only in `ctx`, not on `msg`.

**Fix:** `handler.js` lines 353-360 — injects `msg.sender`, `msg.chat`, `msg.body`, `msg.text`, `msg.isGroup`, `msg.isOwner`, `msg.from` before calling `command.execute`.

### 3. `.developer` — "Cannot read properties of undefined (reading 'length')"

**Root cause:** The `developer` command did not exist. Any reference to it would fail.

**Fix:** Created `commands/general/developer.js` with Beaute Gar info.

### 4. `.diagnostic` — "Cannot read properties of undefined (reading 'length')"

**Root cause:** `require('../command.cjs').commands.length` — `commands` is a `Map`, not an array. `Map.length` is `undefined`.

**Fix:** Both `commands/general/diagnostic.js` and `commands/tool/diagnostic.js` now use `commandMap.size`.

---

## Architecture Understanding

### Two Plugin Systems Coexist

| System | Signature | Examples |
|--------|-----------|----------|
| `cmd()` KnightBot | `async (conn, m, commands, { q, reply })` | alive.js, diagnostic.js, utility-tools.js |
| `module.exports` | `async (sock, msg, args, ctx)` | ping.js, menu.js, ai.js, sticker.js |

Both now work because:
- **Handler** injects `sender`, `chat`, `body`, etc. on `msg` before calling execute
- **cmd() wrapper** injects `reply`, `react`, `chat`, `sender`, etc. on `msg` for KnightBot-style
- **Context** (`ctx`) contains all common properties: `from`, `sender`, `isGroup`, `reply`, `react`, `body`, `q`, `prefix`, `conn`, `args`

### Data Flow

```
WhatsApp message
  → index.js (messages.upsert)
    → handler.handleMessage(sock, msg)
      → parse body, args, commandName
      → inject msg.sender/chat/body
      → build ctx { from, sender, reply, react, q, ... }
      → command.execute(sock, msg, args, ctx)
        → if cmd() wrapper: inject m.reply/react, call handler(conn, m, args, ctx)
        → if module.exports: call execute(sock, msg, args, ctx) directly
      → track stats via sessionManager.incrementStat()
      → emit command:executed event
```

---

## Files Modified

| File | Change |
|------|--------|
| `handler.js` | +bus/sessionManager imports, +msg injection (lines 353-360), +ctx with q/body/prefix/conn, +stats tracking (lines 376-393) |
| `commands/command.cjs` | Fixed handler call from 3 args to 4, added ctx.q |
| `commands/general/diagnostic.js` | `commands.length` → `commandMap.size` |
| `commands/tool/diagnostic.js` | `commands.length` → `commandMap.size` |
| `commands/general/developer.js` | **NEW** — Developer info command |

---

## Verified

- 748 commands load without errors
- cmd() wrapper correctly passes 4 args with `q` populated
- msg injection works for module.exports plugins
- Stats tracking wired to SessionManager + Event Bus
- Sharp 0.35.4 works (`wa-sticker-formatter` loads OK)

---

## Remaining Items

- `developer` command was created (was missing)
- One duplicate regex command `/^\d$/` (game command, non-blocking)
- `.download()` on quoted messages requires Baileys `downloadContentFromMessage` — used by ~18 media commands (separate fix needed)
- SessionManager stats show 0 until bot runs and processes real commands
