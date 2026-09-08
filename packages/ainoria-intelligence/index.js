export { brainChat, brainChatWithContext, brainSummarize, activateBrain, askGroq, groupManager } from './core/brain.js';
export { CognitiveRuntime } from './core/runtime.js';
export { CognitivePipeline } from './core/pipeline.js';
export { default as CognitiveSDK } from './core/sdk.js';
export { EventBus } from './core/event-bus.js';
export { default as orchestrator } from './agents/agent-framework.js';
export { TrustEngine } from './governance/trust-engine.js';
export { AuditEngine } from './governance/audit-engine.js';
export { ApprovalEngine } from './governance/approval-engine.js';
export { PermissionEngine } from './governance/permission-engine.js';
export { PolicyEngine } from './governance/policy-engine.js';
export { SafetyEngine } from './governance/safety-engine.js';
export { ReasoningEngine } from './reasoning/reasoning-engine.js';
export * as DecisionEngine from './decision/decision-engine.js';
export { PlanningEngine } from './planning/planning-engine.js';
export { ContextEngine } from './context/context-engine.js';
export * as MemoryEngine from './memory/memory-engine.js';
export { SemanticMemory } from './memory/semantic-memory.js';
export * as GoalMemory from './memory/goal-memory.js';
export * as KnowledgeGraph from './knowledge/knowledge-graph.js';
export * as WorldModel from './world/world-model.js';
export { WorkspaceManager } from './workspace/workspace-manager.js';
export { AgentFramework } from './agents/agent-framework.js';
export { CognitiveApp } from './apps/cognitive-app.js';
export { MissionCenter } from './apps/mission-center.js';
export { LivingCRM } from './apps/living-crm.js';
export { UniversalSearch } from './apps/universal-search.js';
export * as IdentityEngine from './identity/identity-engine.js';
export { ForesightEngine } from './foresight/foresight-engine.js';
export { MetaCognition } from './meta/meta-cognition.js';
export { LearningLoop } from './learning/learning-loop.js';
export { ObserverLoop } from './observer/observer-loop.js';
export { ActionExecutor } from './actions/action-executor.js';
export { CognitiveClock } from './core/cognitive-clock.js';
export * as DigitalTwin from './core/digital-twin.js';
export { CognitiveAPI } from './api/cognitive-api.js';
export { CognitiveAPI as api } from './api/cognitive-api.js';

const ENGINE_DEPENDENCIES = {
  identity: [], context: ['identity'], memory: ['context'],
  knowledge_graph: ['memory'], world_model: ['knowledge_graph', 'identity'],
  digital_twin: ['identity'], decision: ['context'],
  reasoning: ['memory', 'knowledge_graph'], planning: ['reasoning', 'decision'],
  foresight: ['planning', 'world_model', 'identity'],
  semantic_memory: ['memory', 'knowledge_graph'],
  cognitive_api: ['planning', 'foresight', 'semantic_memory'],
};

export async function initCognitive() {
  const { default: runtime } = await import('./core/runtime.js');
  if (!globalThis.__cognitiveRuntime) globalThis.__cognitiveRuntime = runtime;
  const { bus, EVENTS } = await import('./core/event-bus.js');
  const { pipeline } = await import('./core/pipeline.js');
  const { addDefaultRules } = await import('./decision/decision-engine.js');
  const { loadPersistedActions } = await import('./automation/automation-engine.js');
  const { planner } = await import('./planning/planning-engine.js');
  const { foresight } = await import('./foresight/foresight-engine.js');
  const { semanticMemory } = await import('./memory/semantic-memory.js');
  const { heartbeat } = await import('./core/heartbeat-scheduler.js');
  const { observer } = await import('./observer/observer-loop.js');
  const { initGovernance } = await import('./governance/index.js');
  const { initAgents } = await import('./agents/index.js');
  const { initWorkspace } = await import('./workspace/index.js');
  const { crm, missionCenter, universalSearch, dashboardPerso } = await import('./apps/index.js');

  addDefaultRules();
  loadPersistedActions();
  planner.getAllMissions();

  const engineNames = Object.keys(ENGINE_DEPENDENCIES);
  for (const name of engineNames) {
    runtime.registerEngine({ name, version: '2.0', dependencies: ENGINE_DEPENDENCIES[name] });
  }
  for (const e of runtime.listEngines()) await runtime.startEngine(e.name).catch(() => {});
  foresight.analyzeTrends().catch(() => {});
  semanticMemory.indexAll().catch(() => {});

  await Promise.allSettled([crm.start(), missionCenter.start(), universalSearch.start(), dashboardPerso.start()]);
  await initWorkspace().catch(() => {});
  await initGovernance().catch(() => {});
  await initAgents().catch(() => {});

  heartbeat.start();
  observer.start();
  bus.emit('cognitive:ready', { timestamp: Date.now() });
}
