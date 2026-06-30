export { bus, default as busInstance, EVENTS } from './event-bus.js';
export {
  resolvePerson, getPerson, updatePerson,
  relatePersons, getRelations,
  getFrequent, searchPersons, getAllPersons,
} from './identity-engine.js';
export {
  addNode, getNode, findNodes,
  addEdge, getRelated, shortestPath,
  searchNodes, getStats, NODE_TYPES, REL_TYPES,
} from './knowledge-graph.js';
export {
  storeShortTerm, getShortTerm, getRecentShortTerm,
  storeLongTerm, recallLongTerm, recallRecent,
  recallGlobal, getConversationSummary,
  summarizeAndStore, clearShortTerm, clearLongTerm,
} from './memory-engine.js';
export {
  getContext, addToContext, removeContext,
  getActiveContexts, labelContext, findContextsByLabel,
  ConversationContext,
} from './context-engine.js';
export {
  addRule, removeRule, getRules, enableRule, disableRule,
  addDefaultRules, evaluate, getStats as getDecisionStats,
} from './decision-engine.js';
export {
  createAction, completeAction, cancelAction, getPendingActions,
  getActionsByJid, detectTasksFromText, getOverdueActions,
  loadPersistedActions, ACTION_TYPES,
} from './automation-engine.js';
export {
  query, answerWithContext, getQueueStats,
} from './ai-orchestrator.js';
export {
  getWorldSummary, getEntityProfile,
  searchWorld, getTimeline, getWorldInsights, getWorldState,
} from './world-model.js';
export {
  getOrCreateTwin, getTwin, updateProfile,
  observeInteraction, getTwinSummary,
  getAllTwins, findTwinsByScore, clearTwinCache,
} from './digital-twin.js';
export {
  reasoner, ReasoningEngine, ReasoningTrace,
} from './reasoning-engine.js';
export {
  createGoal, updateGoal, getGoal, getActiveGoals,
  getAllGoals, getGoalsByTag, getGoalStats,
  getGoalHierarchy, detectGoalsFromText, GOAL_STATUS,
} from './goal-memory.js';
export {
  meta, default as metaInstance,
} from './meta-cognition.js';
export {
  planner, PlanningEngine, Mission,
} from './planning-engine.js';
export {
  registry, EngineSDK,
} from './engine-sdk.js';
export {
  foresight, CognitiveForesightEngine,
  FutureGraph, FutureNode, DecisionReplay,
} from './foresight-engine.js';
export {
  semanticMemory, SemanticMemoryEngine,
  KnowledgeMesh,
  EpisodeMemory, ConceptMemory, RelationshipMemory,
  ReasoningMemory, MissionMemory, TimelineMemory,
  EmbeddingMemory, ContextMemory,
} from './semantic-memory.js';
export {
  runtime, CognitiveRuntime,
} from './cognitive-runtime.js';
export {
  multimodal, MultimodalEngine, CognitiveObject,
} from './multimodal-engine.js';
export {
  api, CognitiveAPI,
} from './cognitive-api.js';
export {
  CognitiveApp,
  crm, LivingCRM,
  missionCenter, MissionCenter,
  universalSearch, UniversalSearch,
  dashboard, ExecutiveDashboard,
} from './apps/index.js';

export {
  CognitiveAgent,
  AgentOrchestrator,
  orchestrator,
  AGENT_STATES,
  executive, ExecutiveAgent,
  research, ResearchAgent,
  communication, CommunicationAgent,
  learning, LearningAgent,
  initAgents,
} from './agents/index.js';

export {
  policy, PolicyEngine, Policy, POLICY_EFFECTS,
  permissions, PermissionEngine, PermissionSet, PERMISSIONS, RESOURCE_TYPES,
  approval, ApprovalEngine, APPROVAL_STATUS,
  audit, AuditEngine, AUDIT_ACTIONS,
  trust, TrustEngine,
  safety, SafetyEngine, SAFETY_STATUS,
  initGovernance,
} from './governance/index.js';

export {
  createAgent, AgentBuilder, sdk,
} from './cognitive-sdk.js';

export {
  workspaceManager, Workspace, WorkspaceManager,
  discovery, AutoDiscovery,
  groupStore, GroupObjectStore, GroupCognitiveObject,
  groupFactory, GroupAgentFactory, GroupAgent,
  handleOSCommand,
  initWorkspace,
} from './workspace/index.js';

export { vision, VisionEngine } from './vision-engine.js';
export { cache, PerfCache } from './perf-cache.js';

export async function initCognitive() {
  const { addDefaultRules } = await import('./decision-engine.js');
  const { loadPersistedActions } = await import('./automation-engine.js');
  const { planner } = await import('./planning-engine.js');
  const { foresight } = await import('./foresight-engine.js');
  const { semanticMemory } = await import('./semantic-memory.js');
  const { runtime, ENGINE_DEPENDENCIES } = await import('./cognitive-runtime.js');
  const { multimodal } = await import('./multimodal-engine.js');
  const { api } = await import('./cognitive-api.js');
  addDefaultRules();
  loadPersistedActions();
  planner.getAllMissions();
  runtime.registerEngine({ name: 'identity', version: '2.0', dependencies: ENGINE_DEPENDENCIES.identity });
  runtime.registerEngine({ name: 'context', version: '2.0', dependencies: ENGINE_DEPENDENCIES.context });
  runtime.registerEngine({ name: 'memory', version: '2.0', dependencies: ENGINE_DEPENDENCIES.memory });
  runtime.registerEngine({ name: 'knowledge_graph', version: '2.0', dependencies: ENGINE_DEPENDENCIES.knowledge_graph });
  runtime.registerEngine({ name: 'world_model', version: '2.0', dependencies: ENGINE_DEPENDENCIES.world_model });
  runtime.registerEngine({ name: 'digital_twin', version: '2.0', dependencies: ENGINE_DEPENDENCIES.digital_twin });
  runtime.registerEngine({ name: 'decision', version: '2.0', dependencies: ENGINE_DEPENDENCIES.decision });
  runtime.registerEngine({ name: 'reasoning', version: '2.0', dependencies: ENGINE_DEPENDENCIES.reasoning });
  runtime.registerEngine({ name: 'planning', version: '2.0', dependencies: ENGINE_DEPENDENCIES.planning });
  runtime.registerEngine({ name: 'foresight', version: '2.0', dependencies: ENGINE_DEPENDENCIES.foresight });
  runtime.registerEngine({ name: 'semantic_memory', version: '2.0', dependencies: ENGINE_DEPENDENCIES.semantic_memory });
  runtime.registerEngine({ name: 'multimodal', version: '1.0', dependencies: ['semantic_memory'] });
  runtime.registerEngine({ name: 'cognitive_api', version: '1.0', dependencies: ['multimodal', 'semantic_memory', 'planning', 'foresight'] });
  for (const e of runtime.listEngines()) await runtime.startEngine(e.name).catch(() => {});
  foresight.analyzeTrends().catch(() => {});
  semanticMemory.indexAll().catch(() => {});
  const { crm, missionCenter, universalSearch, dashboard } = await import('./apps/index.js');
  await Promise.allSettled([crm.start(), missionCenter.start(), universalSearch.start(), dashboard.start()]);
  const { initAgents } = await import('./agents/index.js');
  const { initGovernance } = await import('./governance/index.js');
  await initGovernance().catch(err => console.error('Governance init failed:', err.message));
  await initAgents().catch(err => console.error('Agent init failed:', err.message));
  const { bus, EVENTS } = await import('./event-bus.js');
  bus.emit('cognitive:ready', { timestamp: Date.now() });
}
