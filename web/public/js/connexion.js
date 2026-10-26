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

/**
 * Formate dynamiquement le numéro selon le pays (parenthèses, espaces, tirets)
 */
function formatPhoneNumber(value, countryCode) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  // États-Unis / Canada (+1) -> (XXX) XXX-XXXX
  if (countryCode === '1') {
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }

  // France (+33) ou formats standards -> Groupes espacés
  if (countryCode === '33' || countryCode === '237' || digits.length >= 8) {
    return digits.slice(0, 10).replace(/(\d{1,3})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/, (match, p1, p2, p3, p4, p5) => {
      return [p1, p2, p3, p4, p5].filter(Boolean).join(' ');
    });
  }

  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

numberField?.addEventListener('input', (e) => {
  const countryDigits = String(countryField?.value || '').replace(/\D/g, '');
  e.target.value = formatPhoneNumber(e.target.value, countryDigits);
});

countryField?.addEventListener('change', () => {
  if (numberField && numberField.value) {
    const countryDigits = String(countryField.value || '').replace(/\D/g, '');
    numberField.value = formatPhoneNumber(numberField.value, countryDigits);
  }
});

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
  if (error.kind === 'session') return 'Une session est déjà enregistrée pour ce numéro.';
  if (error.kind === 'rate-limit') return 'Trop de tentatives. Patiente avant de demander un nouveau code.';
  return 'Service de jumelage indisponible pour le moment.';
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const localValue = String(numberField?.value || '').replace(/\D/g, '');
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