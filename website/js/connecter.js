'use strict';

(() => {
  const VIGIL_URL = 'https://vigil-delta-lake.vercel.app';
  const STORAGE_KEY = 'djousse-whatsapp-enrollment';
  const form = document.getElementById('enrollment-form');
  const method = document.getElementById('connect-method');
  const phoneField = document.getElementById('phone-field');
  const phone = document.getElementById('phone');
  const startButton = document.getElementById('start-button');
  const sessionPanel = document.getElementById('session-panel');
  const sessionId = document.getElementById('session-id');
  const status = document.getElementById('session-status');
  const qrBox = document.getElementById('qr-box');
  const pairingCode = document.getElementById('pairing-code');
  const connectionHelp = document.getElementById('connection-help');
  const claimForm = document.getElementById('claim-form');
  const claimSessionId = document.getElementById('claim-session-id');
  const restartButton = document.getElementById('restart-button');
  const error = document.getElementById('form-error');
  let current = null;
  let timer = null;

  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  function startPolling(enrollment) {
    current = enrollment;
    form.hidden = true;
    sessionPanel.hidden = false;
    sessionId.textContent = 'SESSION ' + enrollment.sessionId;
    claimSessionId.value = enrollment.sessionId;
    showError('');
    void poll();
  }

  async function poll() {
    if (!current) return;
    try {
      const response = await fetch(
        VIGIL_URL + '/api/bot/enrollments/' + encodeURIComponent(current.sessionId),
        {
          headers: { Authorization: 'Bearer ' + current.viewToken },
          cache: 'no-store',
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Impossible de lire votre session.');

      qrBox.hidden = true;
      qrBox.replaceChildren();
      pairingCode.hidden = true;
      connectionHelp.hidden = true;

      if (result.claimed) {
        status.textContent = 'Cette session a déjà été associée à un compte Vigil.';
        return;
      }
      if (result.error) {
        status.textContent = result.error;
        restartButton.hidden = false;
        return;
      }

      if (result.connectMethod === 'qr' && result.qrSvg) {
        const image = document.createElement('img');
        image.alt = 'QR code de connexion WhatsApp';
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(result.qrSvg);
        qrBox.replaceChildren(image);
        qrBox.hidden = false;
      } else if (result.connectMethod === 'pairing' && result.pairingCode) {
        pairingCode.textContent = result.pairingCode;
        pairingCode.hidden = false;
      }

      if (result.connected) {
        status.textContent = 'WhatsApp connecté. Le code temporaire a été envoyé dans votre discussion privée.';
        claimForm.hidden = false;
        restartButton.hidden = true;
        return;
      }

      const hasQr = result.connectMethod === 'qr' && Boolean(result.qrSvg);
      const hasPairingCode = result.connectMethod === 'pairing' && Boolean(result.pairingCode);
      status.textContent = hasPairingCode
        ? 'Saisissez ce code dans WhatsApp pour terminer l’appairage.'
        : hasQr
          ? 'Scannez le QR code avec WhatsApp → Appareils liés.'
          : 'Le bot central prépare votre connexion…';
      connectionHelp.hidden = !hasQr && !hasPairingCode;
      restartButton.hidden = true;
      showError('');
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'Erreur de communication avec le service.');
    }

    if (current) timer = setTimeout(() => void poll(), 2500);
  }

  method.addEventListener('change', () => {
    const usesPairing = method.value === 'pairing';
    phoneField.hidden = !usesPairing;
    phone.required = usesPairing;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    startButton.disabled = true;
    startButton.textContent = 'Préparation…';
    showError('');
    try {
      const response = await fetch(VIGIL_URL + '/api/bot/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: method.value, phone: phone.value }),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.errors?.form || result.error || 'Impossible de créer la session.');
      if (typeof result.sessionId !== 'string' || typeof result.viewToken !== 'string') {
        throw new Error('Réponse invalide du service de connexion.');
      }
      const enrollment = { sessionId: result.sessionId, viewToken: result.viewToken };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(enrollment));
      startPolling(enrollment);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'Impossible de créer la session.');
    } finally {
      startButton.disabled = false;
      startButton.textContent = 'Démarrer la connexion';
    }
  });

  restartButton.addEventListener('click', async () => {
    if (!current) return;
    restartButton.disabled = true;
    showError('');
    try {
      const response = await fetch(
        VIGIL_URL + '/api/bot/enrollments/' + encodeURIComponent(current.sessionId),
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + current.viewToken },
          cache: 'no-store',
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Impossible d’arrêter cette session.');

      clearTimeout(timer);
      current = null;
      sessionStorage.removeItem(STORAGE_KEY);
      sessionPanel.hidden = true;
      claimForm.hidden = true;
      restartButton.hidden = true;
      form.hidden = false;
      method.value = 'qr';
      phone.value = '';
      phone.required = false;
      phoneField.hidden = true;
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'Impossible d’arrêter cette session.');
    } finally {
      restartButton.disabled = false;
    }
  });

  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (
      saved &&
      typeof saved.sessionId === 'string' &&
      typeof saved.viewToken === 'string'
    ) {
      startPolling(saved);
    }
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
})();
