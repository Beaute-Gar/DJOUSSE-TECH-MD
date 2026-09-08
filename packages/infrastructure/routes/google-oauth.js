import express from 'express';
import { genererUrlAuth, echangerCodeContreTokens, sauvegarderTokens } from '../../ainoria-intelligence/core/google-calendar.js';
import { createSession } from './web-auth.js';
import { createLogger } from '../logger.js';

const log = createLogger('GOOGLE-OAUTH');
const router = express.Router();

router.get('/auth/google', (req, res) => {
  try {
    const { user_id, error } = req.query;
    if (error === 'access_denied') {
      return res.send(`<h3>Autorisation refusee</h3><p>Tu peux reessayer quand tu veux.</p><a href="/auth/google?user_id=${encodeURIComponent(user_id || '')}">Reessayer</a>`);
    }
    if (!user_id) {
      return res.status(400).send('<h3>Parametre user_id manquant</h3><p>Ajoute ?user_id=ton_jid_whatsapp a l\'URL.</p>');
    }
    const url = genererUrlAuth(user_id);
    res.redirect(url);
  } catch (err) {
    console.error('/auth/google:', err.message);
    res.status(500).send('Erreur interne');
  }
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state: userId, error } = req.query;

    if (error === 'access_denied') {
      return res.send('<h3>Tu as refuse l\'autorisation.</h3><p>Aucun probleme - reviens quand tu veux.</p>');
    }

    if (!code || !userId) {
      return res.status(400).send('Parametres manquants.');
    }

    const tokens = await echangerCodeContreTokens(code);
    await sauvegarderTokens(userId, tokens);

    if (userId === 'web' || userId.startsWith('web_')) {
      const session = createSession(userId, 'google');
      log.info(`Google login web reussi: ${userId}`);
      return res.redirect(`/?auth_token=${session.token}`);
    }

    res.send(`<h3>Calendrier connecte !</h3><p>Tu peux retourner sur WhatsApp et utiliser <b>.rdv</b>.</p>`);
  } catch (err) {
    console.error('/auth/google/callback:', err.message);
    const message = err.message.includes('invalid_grant')
      ? 'Le code d\'autorisation a expire. Recommence depuis WhatsApp.'
      : `Erreur : ${err.message}`;
    if (userId === 'web' || userId?.startsWith('web_')) {
      return res.redirect('/login-split?error=auth_failed');
    }
    res.status(500).send(`<h3>Erreur</h3><p>${message}</p>`);
  }
});

export default router;
