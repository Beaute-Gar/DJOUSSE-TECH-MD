import { google } from 'googleapis';
import { rawGet, rawRun } from '../../infrastructure/database/database.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];

export function creerClientOAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function genererUrlAuth(userId) {
  const oauth2Client = creerClientOAuth();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: userId,
  });
}

export async function echangerCodeContreTokens(code) {
  const oauth2Client = creerClientOAuth();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function sauvegarderTokens(userId, tokens) {
  const maintenant = Date.now();
  const existant = await rawGet('SELECT user_id FROM google_calendar_tokens WHERE user_id = ?', [userId]);
  if (existant) {
    await rawRun(
      `UPDATE google_calendar_tokens SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expiry_date = ?, maj_le = ? WHERE user_id = ?`,
      [tokens.access_token, tokens.refresh_token, tokens.expiry_date, maintenant, userId]
    );
  } else {
    await rawRun(
      `INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expiry_date, cree_le, maj_le) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date, maintenant, maintenant]
    );
  }
}

async function getClientAuthentifie(userId) {
  const jetons = await rawGet('SELECT access_token, refresh_token, expiry_date FROM google_calendar_tokens WHERE user_id = ?', [userId]);
  if (!jetons) return null;

  const client = creerClientOAuth();
  client.setCredentials({
    access_token: jetons.access_token,
    refresh_token: jetons.refresh_token,
    expiry_date: jetons.expiry_date,
  });

  client.on('tokens', async (nouveauxJetons) => {
    if (nouveauxJetons.refresh_token || nouveauxJetons.access_token) {
      await rawRun(
        `UPDATE google_calendar_tokens SET access_token = COALESCE(?, access_token), refresh_token = COALESCE(?, refresh_token), expiry_date = ?, maj_le = ? WHERE user_id = ?`,
        [nouveauxJetons.access_token, nouveauxJetons.refresh_token, nouveauxJetons.expiry_date, Date.now(), userId]
      );
    }
  });

  return client;
}

function getCalendar(client) {
  return google.calendar({ version: 'v3', auth: client });
}

export async function aCalendrierConnecte(userId) {
  const ligne = await rawGet('SELECT user_id FROM google_calendar_tokens WHERE user_id = ?', [userId]);
  return !!ligne;
}

export async function listerEvenements(userId, maxResultats = 10) {
  const client = await getClientAuthentifie(userId);
  if (!client) throw new Error('Calendrier non connecté');
  const calendar = getCalendar(client);
  const reponse = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: maxResultats,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return reponse.data.items || [];
}

export async function creerEvenement(userId, { titre, description, debut, fin, invitesEmails = [] }) {
  const client = await getClientAuthentifie(userId);
  if (!client) throw new Error('Calendrier non connecté');
  const calendar = getCalendar(client);
  const evenement = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: titre,
      description,
      start: { dateTime: debut instanceof Date ? debut.toISOString() : debut },
      end: { dateTime: fin instanceof Date ? fin.toISOString() : fin },
      attendees: invitesEmails.map(email => ({ email })),
    },
  });
  return evenement.data;
}

export async function modifierEvenement(userId, eventId, modifications) {
  const client = await getClientAuthentifie(userId);
  if (!client) throw new Error('Calendrier non connecté');
  const calendar = getCalendar(client);
  const body = {};
  if (modifications.titre) body.summary = modifications.titre;
  if (modifications.description) body.description = modifications.description;
  if (modifications.debut) body.start = { dateTime: modifications.debut instanceof Date ? modifications.debut.toISOString() : modifications.debut };
  if (modifications.fin) body.end = { dateTime: modifications.fin instanceof Date ? modifications.fin.toISOString() : modifications.fin };
  const evenement = await calendar.events.update({
    calendarId: 'primary',
    eventId,
    requestBody: body,
  });
  return evenement.data;
}

export async function supprimerEvenement(userId, eventId) {
  const client = await getClientAuthentifie(userId);
  if (!client) throw new Error('Calendrier non connecté');
  const calendar = getCalendar(client);
  await calendar.events.delete({ calendarId: 'primary', eventId });
}

export async function trouverCreneauCommun(participantsUserIds, dureeMinutes, fenetreRecherche) {
  const participantsSansCalendrier = [];
  const busyParParticipant = [];

  for (const userId of participantsUserIds) {
    const client = await getClientAuthentifie(userId);
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
    const occupations = reponse.data.calendars.primary.busy.map(b => ({
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

export function formaterEvenementsPourMessage(evenements) {
  if (!evenements.length) return 'Aucun événement à venir.';
  return evenements.map((e, i) => {
    const debut = e.start?.dateTime || e.start?.date || '';
    const date = new Date(debut).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    return `${i + 1}. ${e.summary || 'Sans titre'} — ${date}`;
  }).join('\n');
}
