import { ApiError, getPairingCode, getStatus } from './api.js';

const form = document.querySelector('[data-pair-form]');
const submitButton = document.querySelector('[data-pair-submit]');
const numberField = document.querySelector('[data-phone-number]');
const countryField = document.querySelector('[data-country-code]');
const codeBox = document.querySelector('[data-pair-code]');
const statusLine = document.querySelector('[data-pair-message]');
const connectionBadge = document.querySelector('[data-connection-status]');
const copyCode = document.querySelector('[data-copy-pair-code]');
const statusCount = document.querySelector('[data-status-connection]');
let statusTimer;
let controller;

function message(text, state = '') {
  if (!statusLine) return;
  statusLine.textContent = text;
  statusLine.dataset.state = state;
}

function setConnectionStatus(status) {
  if (!connectionBadge) return;
  const isConnected = Boolean(status?.connected);
  connectionBadge.dataset.state = isConnected ? 'online' : 'offline';
  connectionBadge.textContent = isConnected ? 'Bot connecté' : 'Bot non connecté';
  if (statusCount) statusCount.textContent = status?.active == null ? '—' : String(status.active);
}

async function refreshStatus() {
  try {
    const status = await getStatus();
    setConnectionStatus(status);
  } catch {
    if (connectionBadge) {
      connectionBadge.dataset.state = 'offline';
      connectionBadge.textContent = 'Service de jumelage indisponible pour le moment.';
    }
    if (statusCount) statusCount.textContent = '—';
  }
}

function explainError(error) {
  if (!(error instanceof ApiError)) return 'Service de jumelage indisponible pour le moment.';
  if (error.kind === 'invalid') return 'Numéro invalide. Vérifie l’indicatif et saisis uniquement des chiffres.';
  if (error.kind === 'session') return 'Une session est déjà enregistrée sur ce bot (HTTP 409). Le jumelage est refusé.';
  if (error.kind === 'rate-limit') return 'Trop de tentatives. Patiente avant de demander un nouveau code.';
  return 'Service de jumelage indisponible pour le moment.';
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const localValue = String(numberField?.value || '').trim();
  const countryDigits = String(countryField?.value || '').replace(/\D/g, '');
  const allDigits = `${countryDigits}${localValue}`;
  if (!/^\d+$/.test(localValue) || !/^[1-9]\d{7,14}$/.test(allDigits)) {
    message('Numéro invalide : vérifie l’indicatif et saisis entre 8 et 15 chiffres au total.', 'error');
    numberField?.focus();
    return;
  }

  submitButton.disabled = true;
  if (copyCode) copyCode.hidden = true;
  if (codeBox) codeBox.textContent = '••••  ••••';
  message('Demande du code en cours…');
  controller?.abort();
  controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const code = await getPairingCode(`+${allDigits}`, { signal: controller.signal });
    if (codeBox) codeBox.textContent = `${code.slice(0, 4)} ${code.slice(4)}`;
    if (copyCode) copyCode.hidden = false;
    message('Code reçu. Saisis-le dans WhatsApp sur ton téléphone.', 'success');
    await refreshStatus();
  } catch (error) {
    if (error.name === 'AbortError') {
      message('Délai dépassé après 15 secondes. Service de jumelage indisponible pour le moment.', 'error');
    } else {
      message(explainError(error), 'error');
    }
    if (codeBox) codeBox.textContent = '••••  ••••';
  } finally {
    window.clearTimeout(timeout);
    submitButton.disabled = false;
  }
});

if (copyCode) {
  copyCode.addEventListener('click', () => {
    const value = codeBox?.textContent?.replace(/\s/g, '');
    if (value && /^[A-Z0-9]{8}$/.test(value)) copyCode.dataset.copyText = value;
  });
}

refreshStatus();
statusTimer = window.setInterval(refreshStatus, 30000);
window.addEventListener('pagehide', () => {
  window.clearInterval(statusTimer);
  controller?.abort();
});
