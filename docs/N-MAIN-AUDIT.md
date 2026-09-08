# N-MAIN AUDIT REPORT

**Date:** 2026-09-02  
**Auditor:** OpenCode  
**Source:** N-main.zip (177 JS/CJS files)

---

## EXECUTIVE SUMMARY

| Category | Count | Action |
|---|---|---|
| ☠️ DANGEROUS | 7 | **EXCLUDE** — Never integrate |
| 🟡 NEEDS_ADAPTATION | 48 | **ADAPT** — With modifications |
| 🟢 SAFE | 122 | **INTEGRATE** — Direct port |

---

## ☠️ DANGEROUS FILES (EXCLUDE)

### WhatsApp Crash Payloads
| File | Risk | Description |
|---|---|---|
| `bug/inconnu3.js` | CRITICAL | Unicode crash payload (198KB) |
| `bug/inconnu5.js` | CRITICAL | Unicode crash payload (131KB) |
| `inconnu/inconnuTech/bug3.js` | HIGH | `.inconnu-blast` mass spam |
| `inconnu/inconnuTech/bug4.js` | HIGH | `.ios-kill` target attack |
| `inconnu/inconnuTech/bug5.js` | HIGH | `.x-force` target attack |

### Remote Code Execution
| File | Risk | Description |
|---|---|---|
| `inconnu/inconnuTech/deploy.js` | CRITICAL | `child_process.fork()` from WhatsApp |
| `inconnu/inconnuTech/update.js` | HIGH | Remote ZIP overwrite entire project |

### Hardcoded Secrets
| File | Risk | Description |
|---|---|---|
| `config.cjs` | HIGH | Gemini API key hardcoded |
| `index.js` | HIGH | MEGA session download system |

---

## 🟡 FILES REQUIRING ADAPTATION

### Critical Adaptations
| File | Issue | Solution |
|---|---|---|
| `calc.js` | `new Function()` eval | Use `mathjs` (already in DJOUSSE TECH) |
| `calculator.js` | `new Function()` eval | Use `mathjs` |
| `voicechanger.js` | `exec()` shell injection | Replace with `spawn()` |
| `bot.js` | Hardcoded session_id | Use `.env` variable |
| `chatbot.js` | External API dependency | Route through Service Gateway |
| `Shazam.js` | Hardcoded ACRCloud keys | Use `.env` variables |
| `movie.js` | Hardcoded OMDB key | Use `.env` variable |

### External API Files (40+)
All external API calls must be:
1. Routed through Service Gateway
2. Have timeout/retry logic
3. Use `.env` for API keys
4. Have error handling

---

## 🟢 SAFE FILES FOR INTEGRATION

### Group Management (28 files)
- `Anti-spam.js`, `antilink.js`, `antibot.js`, `antidelete.js`
- `welcomeset.js`, `ginfo.js`, `gname.js`, `groupbio.js`
- `Groupsettings.js`, `hidetag.js`, `tagall.js`, `tagadmin.js`
- `kick.js`, `kickall.js`, `kickall2.js`
- `promote.js`, `promoteall.js`, `demote.js`, `demoteall.js`
- `block.js`, `Unblock.js`, `poll.js`, `vcf.js`
- `save.js`, `xsave.js`, `statussave.js`, `statusreply.js`

### Media Processing (15 files)
- `toimage.js`, `tomp3.js`, `toqr.js`
- `stick.js`, `take.js`, `autosticker.js`
- `emomix.js`, `fancy.js`, `img.js`
- `Removebg.js`, `Qrrederi.js`
- `lib/converter.cjs`, `lib/exif.cjs`

### Utilities (20 files)
- `trt.js`, `uptime.js`, `version.js`, `me.js`
- `profile.js`, `getpp.js`, `jid.js`
- `alive.js`, `allcmds.js`, `allvar.js`
- `Prefixset.js`, `setstatusmsg.js`
- `report.js`, `thanks-to.js`
- `lib/binary.cjs`, `lib/Serializer.js`

### Games (12 files)
- `dare.js`, `quiz.js`, `ttt.js`, `connect4.js`
- `love.js`, `couples-dp.js`, `score.js`
- `economy.js`, `rank.js`
- `lib/level.js`

### Security (10 files)
- `lib/antibot.js`, `lib/banUser.js`, `lib/banGroup.js`
- `lib/warn.js`, `lib/welcome.js`, `lib/mention.js`
- `lib/onlyAdmin.js`, `lib/sudo.js`
- `lib/cron.js`

---

## INTEGRATION STRATEGY

### Phase 1: Documentation (Current)
- [x] Create audit report
- [ ] Create rejected files list
- [ ] Create integration plan

### Phase 2: Safe Files (28 files)
- [ ] Copy to `plugins/nmain/`
- [ ] Adapt to DJOUSSE TECH `cmd()` format
- [ ] Test each command

### Phase 3: Adaptation Files (48 files)
- [ ] Replace dangerous patterns
- [ ] Extract hardcoded keys to `.env`
- [ ] Integrate with existing engines

### Phase 4: Security Hardening
- [ ] Route through Permission Engine
- [ ] Add Service Gateway
- [ ] Implement rate limiting

---

## BAILEYS STATUS

**CONSERVED:** `@whiskeysockets/baileys@6.7.24`  
**SESSION:** Existing WhatsApp session preserved  
**ARCHITECTURE:** Core DJOUSSE TECH architecture unchanged

---

## NEXT STEPS

1. Exit plan mode
2. Execute Phase 1 documentation
3. Begin Phase 2 integration
4. Test after each step
5. Commit and push
