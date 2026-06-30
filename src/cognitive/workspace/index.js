export { workspaceManager, Workspace, WorkspaceManager } from './workspace-manager.js';
export { discovery, AutoDiscovery } from './auto-discovery.js';
export { GroupCognitiveObject, GroupObjectStore, groupStore } from './group-cognitive-object.js';
export { GroupAgentFactory, groupFactory, GroupAgent } from './group-agent-factory.js';
export { handleOSCommand } from './os-commands.js';

export async function initWorkspace() {
  const { workspaceManager } = await import('./workspace-manager.js');
  const { groupStore } = await import('./group-cognitive-object.js');
  const { bus } = await import('../event-bus.js');
  bus.emit('workspace:ready', { timestamp: Date.now() });
  return { workspaceManager, groupStore };
}

export default {
  workspaceManager, discovery, groupStore, groupFactory, handleOSCommand, initWorkspace,
};
