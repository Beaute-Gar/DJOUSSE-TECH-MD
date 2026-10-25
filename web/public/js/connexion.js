'use strict';

/**
 * DJOUSSE TECH MD — Gestionnaire du formulaire de connexion et pairage
 */

document.addEventListener('DOMContentLoaded', () => {
  const pairingForm = document.getElementById('pairing-form') || document.querySelector('form');
  const phoneInput = document.getElementById('phone-input') || document.querySelector('input[type="tel"]');
  const submitBtn = document.getElementById('submit-btn') || document.querySelector('button[type="submit"]');
  const resultContainer = document.getElementById('pairing-result') || document.getElementById('status-message');

  // Vérification de l'état du serveur au chargement de la page
  checkServerStatus();

  if (pairingForm) {
    pairingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!phoneInput) return;

      const rawPhone = phoneInput.value.trim();
      const cleanPhone = rawPhone.replace(/\D/g, '');

      if (!cleanPhone || cleanPhone.length < 8 || cleanPhone.length > 15) {
        showResult('Veuillez entrer un numéro valide avec l\'indicatif international (ex: 237XXXXXXXXX).', 'error');
        return;
      }

      // Indique au système que la demande est en cours
      setLoading(true);
      showResult('Génération du code de pairage en cours...', 'info');

      try {
        const response = await window.ApiService.requestPairing(cleanPhone);
        
        if (response && (response.code || response.pairingCode)) {
          const code = response.code || response.pairingCode;
          showResult(`Votre code de pairage : <strong>${code}</strong><br><small>Ouvrez WhatsApp > Appareils liés > Lier avec un numéro de téléphone</small>`, 'success');
        } else if (response && response.message) {
          showResult(response.message, 'info');
        } else {
          showResult('Code généré. Vérifiez votre console ou relancez si nécessaire.', 'success');
        }
      } catch (error) {
        showResult(`Échec du pairage : ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    });
  }

  async function checkServerStatus() {
    try {
      const status = await window.ApiService.getStatus();
      console.log('[Bot Status]:', status);
    } catch (err) {
      console.warn('[Bot Server Unreachable]: Le serveur Render semble endormi ou hors ligne.');
    }
  }

  function setLoading(isLoading) {
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading ? 'Connexion...' : 'Obtenir le code';
    }
  }

  function showResult(message, type) {
    if (!resultContainer) return;
    resultContainer.innerHTML = message;
    resultContainer.className = `status-box status-${type}`;
    resultContainer.style.display = 'block';
  }
});