import argon2 from 'argon2';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { rawRun, rawGet, initDB } from '../database/database.js';
import { createLogger } from '../logger.js';

const log = createLogger('ADMIN-AUTH');

export async function initAdminAuth() {
  await initDB();
  rawRun(`CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY,
    mot_de_passe_hash TEXT NOT NULL,
    secret_totp TEXT NOT NULL,
    deux_fa_active INTEGER DEFAULT 0,
    jeton_2fa_temporaire TEXT,
    jeton_2fa_expire_le INTEGER,
    cree_le INTEGER
  )`);
  log.info('Table admins prete');
}

export async function hasherMotDePasse(motDePasse) {
  return argon2.hash(motDePasse, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifierMotDePasse(motDePasseFourni, hashStocke) {
  try {
    return await argon2.verify(hashStocke, motDePasseFourni);
  } catch {
    return false;
  }
}

export async function creerCompteAdmin(email, motDePasse) {
  await initAdminAuth();
  const hash = await hasherMotDePasse(motDePasse);
  const secretTOTP = authenticator.generateSecret();
  rawRun(
    `INSERT OR REPLACE INTO admins (email, mot_de_passe_hash, secret_totp, deux_fa_active, cree_le) VALUES (?, ?, ?, 0, ?)`,
    [email, hash, secretTOTP, Date.now()]
  );
  const otpauthUrl = authenticator.keyuri(email, 'DJOUSSE TECH Admin', secretTOTP);
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
  return { qrCodeDataUrl, secretTOTP };
}

export async function verifierEtapeMotDePasse(email, motDePasse) {
  await initAdminAuth();
  const admin = rawGet(`SELECT * FROM admins WHERE email = ?`, [email]);
  if (!admin) return { valide: false };
  const motDePasseValide = await verifierMotDePasse(motDePasse, admin.mot_de_passe_hash);
  if (!motDePasseValide) return { valide: false };
  const jetonTemporaire = crypto.randomBytes(24).toString('hex');
  rawRun(
    `UPDATE admins SET jeton_2fa_temporaire = ?, jeton_2fa_expire_le = ? WHERE email = ?`,
    [jetonTemporaire, Date.now() + 5 * 60 * 1000, email]
  );
  return { valide: true, jetonTemporaire, deuxFaActive: !!admin.deux_fa_active };
}

export async function verifierEtapeTOTP(email, jetonTemporaire, codeTOTP) {
  await initAdminAuth();
  const admin = rawGet(`SELECT * FROM admins WHERE email = ?`, [email]);
  if (!admin) return { valide: false };
  if (admin.jeton_2fa_temporaire !== jetonTemporaire || Date.now() > admin.jeton_2fa_expire_le) {
    return { valide: false, raison: 'jeton_expire' };
  }
  const codeValide = authenticator.verify({ token: codeTOTP, secret: admin.secret_totp });
  if (!codeValide) return { valide: false, raison: 'code_invalide' };
  rawRun(`UPDATE admins SET jeton_2fa_temporaire = NULL, deux_fa_active = 1 WHERE email = ?`, [email]);
  return { valide: true };
}
