# N-MAIN REJECTED FILES

**Date:** 2026-09-02  
**Reason:** Security risks, malicious code, or incompatible architecture

---

## ☠️ CRITICAL REJECTION (Never Integrate)

### WhatsApp Crash/Attack Tools
| File | Command | Risk | Alternative |
|---|---|---|---|
| `bug/inconnu3.js` | — | WhatsApp CRASH payload | NONE (malicious) |
| `bug/inconnu5.js` | — | WhatsApp CRASH payload | NONE (malicious) |
| `inconnu/inconnuTech/bug3.js` | `.inconnu-blast` | Mass spam attack | NONE (malicious) |
| `inconnu/inconnuTech/bug4.js` | `.ios-kill` | iOS kill attack | NONE (malicious) |
| `inconnu/inconnuTech/bug5.js` | `.x-force` | Target attack | NONE (malicious) |

### Remote Code Execution
| File | Command | Risk | Alternative |
|---|---|---|---|
| `inconnu/inconnuTech/deploy.js` | `.deploy` | child_process.fork() | NONE (RCE) |
| `inconnu/inconnuTech/update.js` | `.update` | Remote ZIP overwrite | NONE (dangerous) |

### Session/Secret Theft
| File | Risk | Alternative |
|---|---|---|
| `config.cjs` | Hardcoded Gemini key | Use `.env` only |
| `index.js` | MEGA session download | Use local session only |
| `.env` | Contains SESSION_ID | Generate new session |

---

## 🟡 ARCHITECTURE REJECTION (Incompatible)

### ESM Module System
| File | Issue | Alternative |
|---|---|---|
| `package.json` | `"type": "module"` | Use CJS (existing) |
| All `*.js` files | ESM imports | Convert to CJS require() |

### Duplicate Systems
| File | Issue | DJOUSSE TECH Equivalent |
|---|---|---|
| `inconnu/inconnuboy/inconnuv2.js` | Duplicate handler | `src/core/` |
| `lib/Serializer.js` | Duplicate serializer | `lib/wwebjs-msg.cjs` |
| `inconnu/inconnuTech/menu.js` | Duplicate menu | `src/menu-interactif.cjs` |

---

## 🔴 SECURITY REJECTION (Hardcoded Secrets)

### API Keys Found (MUST NOT COPY)
| File | Key Type | Action |
|---|---|---|
| `config.cjs` | Gemini API key | Use `.env` only |
| `inconnu/inconnuTech/Shazam.js` | ACRCloud keys | Use `.env` only |
| `inconnu/inconnuTech/movie.js` | OMDB key | Use `.env` only |
| `inconnu/inconnuTech/tech.js` | NexOracle key | Use `.env` only |
| `inconnu/tech.js` | NexOracle key | Use `.env` only |

---

## 🟠 FUNCTIONALITY REJECTION (Redundant)

### Already in DJOUSSE TECH
| N-main File | DJOUSSE TECH Equivalent |
|---|---|
| `Ping.js` | `plugins/ping.cjs` |
| `alive.js` | `plugins/alive.cjs` |
| `menu.js` | `src/menu-interactif.cjs` |
| `tiktok.js` | `plugins/download.cjs` |
| `facebook.js` | `plugins/download.cjs` |
| `ig.js` | `plugins/ig.cjs` |
| `Removebg.js` | `plugins/image-tools.cjs` |
| `Shazam.js` | `plugins/music-search.cjs` |
| `trt.js` | `plugins/utility-tools.cjs` |

---

## EXTERNAL API REJECTION (Unreliable)

### Third-Party APIs (May be down/compromised)
| File | API | Risk |
|---|---|---|
| `inconnu/inconnuTech/bot.js` | paxsenix.biz.id | Unknown reliability |
| `inconnu/inconnuTech/chatbot.js` | mannoffc-x.hf.space | HuggingFace Space |
| `inconnu/inconnuTech/inconnu-ai.js` | paxsenix.biz.id | Unknown reliability |
| `inconnu/inconnuTech/frilt.js` | shizoapi.onrender.com | Unknown reliability |
| `inconnu/inconnuTech/screenshot.js` | Unknown API | Unknown reliability |
| `inconnu/inconnuTech/url.js` | postimages.org | External service |
| `inconnu/inconnuTech/url2.js` | Unknown API | Unknown reliability |
| `inconnu/inconnuTech/url3.js` | Unknown API | Unknown reliability |
| `inconnu/inconnuTech/zp.js` | bot.lyo.su | Unknown reliability |

---

## SUMMARY

| Category | Count | Action |
|---|---|---|
| CRITICAL REJECTION | 7 | **NEVER INTEGRATE** |
| ARCHITECTURE REJECTION | 3+ | **DO NOT COPY** |
| SECURITY REJECTION | 5+ | **USE .env ONLY** |
| FUNCTIONALITY REJECTION | 9+ | **USE EXISTING** |
| EXTERNAL API REJECTION | 9+ | **EVALUATE FIRST** |

---

## INTEGRATION RULE

**When in doubt, DO NOT INTEGRATE.**

Document the file in this list and move on to safer alternatives.
