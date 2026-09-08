import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('PERSONALITY');
const MODES = {
  eq:       { label: 'Équilibré',      prompt: 'Réponds de façon équilibrée, neutre et professionnelle.',                                                                           emoji: '⚖️' },
  energie:  { label: 'Énergique',      prompt: 'Réponds avec enthousiasme, énergie et dynamisme. Utilise des émojis et des phrases courtes et percutantes.',                      emoji: '⚡' },
  doux:     { label: 'Doux',           prompt: 'Réponds avec douceur, bienveillance et empathie. Sois rassurant et chaleureux.',                                                     emoji: '🕊️' },
  humour:   { label: 'Humour',         prompt: 'Réponds avec humour, légèreté et jeux de mots. Fais rire le destinataire tout en restant utile.',                                    emoji: '😂' },
  formel:   { label: 'Formel',         prompt: 'Réponds de façon formelle, structurée et précise. Utilise un langage soutenu et évite les abréviations.',                           emoji: '👔' },
  poete:    { label: 'Poète',          prompt: 'Réponds de façon poétique et lyrique. Utilise des métaphores et des images évocatrices.',                                           emoji: '🎭' },
};
let current = 'eq';
export function setMode(mode) {
  if (!MODES[mode]) return false;
  current = mode;
  return true;
}
export function getMode() { return current; }
export function getModes() { return MODES; }
export function getModePrompt() { return MODES[current].prompt; }
export function getModeLabel() { return MODES[current].label; }
export function getModeEmoji() { return MODES[current].emoji; }
export function enablePersonalityModes(sock) {
  log.info('Modes de personnalité activés');
}
