import { createLogger } from '../../infrastructure/logger.js';
import { ChannelManager } from '../channels/channel-manager.js';
const log = createLogger('CHANNELFEAT');

let manager = null;

export function getChannelManager(sock) {
  if (!manager) manager = new ChannelManager(sock);
  return manager;
}

export function initChannelSystem(sock) {
  getChannelManager(sock);
  log.info('Système de chaînes initialisé');
}

export { ChannelManager };
