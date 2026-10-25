'use strict';

/**
 * DJOUSSE TECH MD — API Service Front-End (Vercel -> Render)
 * URL Backend : https://djousse-tech-md.onrender.com
 */

const API_BASE_URL = 'https://djousse-tech-md.onrender.com';

const ApiService = {
  /**
   * Effectue une requête HTTP générique vers le serveur Render
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    try {
      const response = await fetch(url, config);
      
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new Error(typeof data === 'string' ? data : (data.message || data.error || 'Erreur serveur'));
      }

      return data;
    } catch (error) {
      console.error(`[API Error] (${endpoint}):`, error.message);
      throw error;
    }
  },

  /**
   * Récupère le statut actuel du bot et de la connexion WhatsApp
   */
  async getStatus() {
    return this.request('/status');
  },

  /**
   * Envoie une demande de code de pairage pour un numéro de téléphone
   * @param {string} phoneNumber Le numéro WhatsApp avec indicatif
   */
  async requestPairing(phoneNumber) {
    return this.request('/pair', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneNumber }),
    });
  }
};

// Rend l'API accessible dans tout le front-end
window.ApiService = ApiService;