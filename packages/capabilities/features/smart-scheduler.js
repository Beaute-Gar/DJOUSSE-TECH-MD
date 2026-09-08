import { google } from 'googleapis';
import { createLogger } from '../../infrastructure/logger.js';
import { rawGet } from '../../infrastructure/database/database.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');

const log = createLogger('SMART-SCHEDULER');

function creerClientOAuth() {
  return new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  );
}

function getClientAuthentifie(userId) {
  const ligne = rawGet('SELECT access_token, refresh_token, expiry_date FROM google_oauth_tokens WHERE user_id = ?', userId);
  if (!ligne) return null;
  const client = creerClientOAuth();
  client.setCredentials({
    access_token: ligne.access_token,
    refresh_token: ligne.refresh_token,
    expiry_date: ligne.expiry_date,
  });
  return client;
}

function getCalendar(client) {
  return google.calendar({ version: 'v3', auth: client });
}

export function aCalendrierConnecte(userId) {
  const ligne = rawGet('SELECT user_id FROM google_oauth_tokens WHERE user_id = ?', userId);
  return !!ligne;
}

export async function proposerCreneau(participantsUserIds, dureeMinutes, fenetreRecherche) {
  const participantsSansCalendrier = [];
  const busyParParticipant = [];

  for (const userId of participantsUserIds) {
    const client = getClientAuthentifie(userId);
    if (!client) {
      participantsSansCalendrier.push(userId);
      continue;
    }
    const calendar = getCalendar(client);
    const reponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: fenetreRecherche.debut.toISOString(),
        timeMax: fenetreRecherche.fin.toISOString(),
        items: [{ id: 'primary' }],
      },
    });
    const occupations = (reponse.data.calendars.primary.busy || []).map(b => ({
      debut: new Date(b.start),
      fin: new Date(b.end),
    }));
    busyParParticipant.push(occupations);
  }

  const creneau = trouverPremierCreneauLibre(busyParParticipant, dureeMinutes, fenetreRecherche);
  return { creneau, participantsSansCalendrier };
}

function trouverPremierCreneauLibre(busyParParticipant, dureeMinutes, fenetreRecherche) {
  const PAS_MINUTES = 15;
  const dureeMs = dureeMinutes * 60 * 1000;
  let curseur = new Date(fenetreRecherche.debut);

  while (curseur.getTime() + dureeMs <= fenetreRecherche.fin.getTime()) {
    const finCreneau = new Date(curseur.getTime() + dureeMs);
    const conflit = busyParParticipant.some(occupations =>
      occupations.some(o => curseur < o.fin && finCreneau > o.debut)
    );
    const heure = curseur.getHours();
    const horaireRaisonnable = heure >= 8 && heure < 19;
    if (!conflit && horaireRaisonnable) {
      return { debut: new Date(curseur), fin: finCreneau };
    }
    curseur = new Date(curseur.getTime() + PAS_MINUTES * 60 * 1000);
  }

  return null;
}

export async function creerEvenement(organisateurUserId, { titre, description, creneau, invitesEmails = [], avecVisio = false }) {
  const client = getClientAuthentifie(organisateurUserId);
  if (!client) throw new Error('Calendrier non connecté');
  const calendar = getCalendar(client);
  const body = {
    summary: titre,
    description: description || '',
    start: { dateTime: creneau.debut instanceof Date ? creneau.debut.toISOString() : creneau.debut },
    end: { dateTime: creneau.fin instanceof Date ? creneau.fin.toISOString() : creneau.fin },
  };
  if (invitesEmails.length) {
    body.attendees = invitesEmails.map(email => ({ email }));
  }
  if (avecVisio) {
    body.conferenceData = {
      createRequest: { requestId: `os-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
    };
  }
  const attendus = {};
  if (avecVisio) attendus.conferenceDataVersion = 1;
  const evenement = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: body,
    ...attendus,
  });
  log.info(`Événement créé: ${titre}`);
  return evenement.data;
}
