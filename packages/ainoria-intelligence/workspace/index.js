export { workspaceManager, Workspace, WorkspaceManager } from './workspace-manager.js';
export { discovery, AutoDiscovery } from './auto-discovery.js';
export { GroupCognitiveObject, GroupObjectStore, groupStore } from './group-cognitive-object.js';
export { GroupAgentFactory, groupFactory, GroupAgent } from './group-agent-factory.js';
import { workspaceManager } from './workspace-manager.js';
import { discovery } from './auto-discovery.js';
import { groupStore } from './group-cognitive-object.js';
import { groupFactory } from './group-agent-factory.js';

export async function initWorkspace() {
  const { bus } = await import('../core/event-bus.js');
  bus.emit('workspace:ready', { timestamp: Date.now() });
  return { workspaceManager, groupStore };
}

export default {
  workspaceManager, discovery, groupStore, groupFactory, initWorkspace,
};
