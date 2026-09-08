# N-MAIN INTEGRATION PLAN

**Date:** 2026-09-02  
**Status:** READY TO EXECUTE  
**Target:** DJOUSSE-TECH-MD

---

## INTEGRATION STRATEGY

### Core Principle
> N-main is a **FEATURE LIBRARY**, not a new architecture.  
> DJOUSSE TECH remains the **MASTER PRODUCT**.

### Architecture Preserved
```
DJOUSSE TECH
     │
     ├── Baileys v6.7.24 (UNCHANGED)
     ├── Event Bus
     ├── Permission Engine
     ├── Policy Engine
     ├── Audit Engine
     ├── Memory Engine
     ├── AI Orchestrator
     ├── Command Registry (cmd())
     └── Plugin System
```

---

## PHASE 1: DOCUMENTATION (Current)

- [x] Create `docs/N-MAIN-AUDIT.md`
- [x] Create `docs/N-MAIN-REJECTED.md`
- [x] Create `docs/N-MAIN-INTEGRATION.md`

---

## PHASE 2: SAFE FILES (28 files)

### Group Management (14 files)
| File | Command | Category | Status |
|---|---|---|---|
| `Anti-spam.js` | `.antispam` | group | READY |
| `antilink.js` | `.antilink` | group | READY |
| `antibot.js` | `.antibot` | group | READY |
| `antidelete.js` | `.antidelete` | group | READY |
| `welcomeset.js` | `.setwelcome` | group | READY |
| `ginfo.js` | `.ginfo` | group | READY |
| `gname.js` | `.gname` | group | READY |
| `groupbio.js` | `.groupbio` | group | READY |
| `Groupsettings.js` | `.groupsettings` | group | READY |
| `hidetag.js` | `.hidetag` | group | READY |
| `tagall.js` | `.tagall` | group | READY |
| `tagadmin.js` | `.tagadmin` | group | READY |
| `kick.js` | `.kick` | group | READY |
| `kickall.js` | `.kickall` | group | READY |

### Admin Management (6 files)
| File | Command | Category | Status |
|---|---|---|---|
| `promote.js` | `.promote` | group | READY |
| `promoteall.js` | `.promoteall` | group | READY |
| `demote.js` | `.demote` | group | READY |
| `demoteall.js` | `.demoteall` | group | READY |
| `block.js` | `.block` | owner | READY |
| `Unblock.js` | `.unblock` | owner | READY |

### Utilities (8 files)
| File | Command | Category | Status |
|---|---|---|---|
| `poll.js` | `.poll` | tools | READY |
| `vcf.js` | `.vcf` | tools | READY |
| `save.js` | `.save` | tools | READY |
| `toimage.js` | `.toimage` | convert | READY |
| `tomp3.js` | `.tomp3` | convert | READY |
| `toqr.js` | `.toqr` | tools | READY |
| `uptime.js` | `.uptime` | info | READY |
| `version.js` | `.version` | info | READY |

---

## PHASE 3: ADAPTATION FILES (48 files)

### Priority 1: Calculator (Replace new Function())
| File | Adaptation | Solution |
|---|---|---|
| `calc.js` | Replace `new Function()` | Use `mathjs` (already installed) |
| `calculator.js` | Replace `new Function()` | Use `mathjs` |

### Priority 2: Media Processing (Replace exec())
| File | Adaptation | Solution |
|---|---|---|
| `voicechanger.js` | Replace `exec()` | Use `spawn()` with args |
| `sounds.js` | Replace `exec()` | Use `spawn()` with args |

### Priority 3: External APIs (Extract to .env)
| File | API | .env Variable |
|---|---|---|
| `Shazam.js` | ACRCloud | `AUDD_API_KEY` (already done) |
| `movie.js` | OMDB | `OMDB_API_KEY` |
| `weather2.js` | OpenWeatherMap | `OPENWEATHER_API_KEY` |

### Priority 4: Games
| File | Command | Adaptation |
|---|---|---|
| `dare.js` | `.dare` | Connect to existing DB |
| `quiz.js` | `.quiz` | Use opentdb.com API |
| `ttt.js` | `.ttt` | Connect to existing DB |
| `connect4.js` | `.connect4` | Connect to existing DB |
| `love.js` | `.love` | Simple calculation |
| `score.js` | `.score` | Connect to existing DB |
| `economy.js` | `.economy` | Connect to existing DB |
| `rank.js` | `.rank` | Connect to existing DB |

---

## PHASE 4: SECURITY HARDENING

### Permission Engine Integration
All commands must pass through:
```
Command
   ↓
Context Engine
   ↓
Permission Engine
   ↓
Policy Engine
   ↓
Approval (if needed)
   ↓
Action
   ↓
Audit Engine
   ↓
Baileys
```

### Service Gateway Pattern
```
Plugin
   ↓
Service Gateway
   ↓
External API
   ↓
Response
```

Benefits:
- Centralized error handling
- Rate limiting
- Caching
- Logging
- API key management

---

## DEPENDENCIES TO ADD

### Already in DJOUSSE TECH
- `mathjs` — Safe math evaluation
- `fluent-ffmpeg` — Media processing
- `sharp` — Image processing
- `node-webpmux` — Sticker handling

### Optional (Evaluate First)
- `acrcloud` — Music recognition (if not using AudD)
- `@google/generative-ai` — Gemini (if needed)

---

## FILE STRUCTURE

### New Directories
```
plugins/
├── nmain/
│   ├── group/
│   │   ├── antispam.cjs
│   │   ├── antilink.cjs
│   │   ├── antibot.cjs
│   │   └── ...
│   ├── admin/
│   │   ├── promote.cjs
│   │   ├── demote.cjs
│   │   └── ...
│   ├── media/
│   │   ├── toimage.cjs
│   │   ├── tomp3.cjs
│   │   └── ...
│   ├── games/
│   │   ├── dare.cjs
│   │   ├── quiz.cjs
│   │   └── ...
│   └── utils/
│       ├── poll.cjs
│       ├── vcf.cjs
│       └── ...
```

---

## TESTING CHECKLIST

### After Each Phase
- [ ] Bot starts without errors
- [ ] Baileys connects successfully
- [ ] Session preserved
- [ ] Commands load correctly
- [ ] No memory leaks
- [ ] No CPU spikes

### After Full Integration
- [ ] All 393+ commands work
- [ ] Group features work
- [ ] Media processing works
- [ ] Games work
- [ ] Permissions work
- [ ] Dashboard works
- [ ] API works

---

## COMMIT STRATEGY

### Commit Messages
```
feat(nmain): add group management plugins
feat(nmain): add admin management plugins
feat(nmain): add media processing plugins
feat(nmain): add game plugins
fix(nmain): replace dangerous patterns
docs(nmain): add audit documentation
```

### Git Tags
```
nmain-phase-1
nmain-phase-2
nmain-phase-3
nmain-phase-4
nmain-complete
```

---

## RISK MITIGATION

### Backup Strategy
1. Git commit before each phase
2. Create checkpoint tags
3. Document all changes

### Rollback Plan
1. If issues arise, revert to last commit
2. Check git diff for problematic changes
3. Test in isolation

### Monitoring
1. Watch bot logs during integration
2. Monitor memory/CPU usage
3. Test commands individually

---

## SUCCESS CRITERIA

### Must Have
- [ ] Baileys v6.7.24 preserved
- [ ] Session preserved
- [ ] All existing commands work
- [ ] No security vulnerabilities
- [ ] No hardcoded secrets

### Should Have
- [ ] 28+ new commands integrated
- [ ] Group features enhanced
- [ ] Media processing expanded
- [ ] Games added
- [ ] Documentation complete

### Nice to Have
- [ ] Service Gateway implemented
- [ ] Rate limiting added
- [ ] Caching implemented
- [ ] Advanced error handling

---

## NEXT STEPS

1. **Exit plan mode** to enable file modifications
2. Execute Phase 2 (Safe Files)
3. Test each integration
4. Commit and push
5. Continue with Phase 3

---

## ESTIMATED TIME

| Phase | Time | Complexity |
|---|---|---|
| Phase 1 | Done | Low |
| Phase 2 | 2-3 hours | Medium |
| Phase 3 | 4-6 hours | High |
| Phase 4 | 2-3 hours | Medium |
| **Total** | **8-12 hours** | — |

---

**Ready to execute when you confirm.**
