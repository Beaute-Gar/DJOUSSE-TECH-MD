import { createLogger } from '../../infrastructure/logger.js';
import { aiRouter } from './ai-router.js';
import { memoryEngine } from './memory-engine.js';
import { toolEngine } from './tool-engine.js';
import { planningEngine } from './planning-engine.js';
import { reasoningEngine } from './reasoning-engine.js';
import { agentOrchestrator } from './agent-orchestrator.js';
import { permissionsEngine } from './permissions-engine.js';
import { contextEngine } from './context-engine.js';
import { contextEngineV2 } from './context-engine-v2.js';
import { worldModel } from './world-model.js';
import { goalManager } from './goal-manager.js';
import { reflectionEngine } from './reflection-engine.js';
import { skillManager } from './skill-manager.js';
import { pluginMarketplace } from './plugin-marketplace.js';
import { tracer } from './tracer.js';
import { securityManager } from './security.js';
import { providerManager } from './ai-provider-interface.js';
import { eventBusV2 } from './event-bus-v2.js';
import * as sdk from './sdk.js';
import { registerAllWATools } from './whatsapp-tools.js';
import { mcpManager } from './mcp/mcp-manager.js';
import { mcpServer } from './mcp/mcp-server.js';
import { mcpToolAdapter } from './mcp/mcp-tool-adapter.js';
import { mcpPermission } from './mcp/mcp-permission.js';
import { mcpResourceManager } from './mcp/mcp-resource-manager.js';

const log = createLogger('AINORIA-CORE');

let initialized = false;

export {
  aiRouter, memoryEngine, toolEngine, planningEngine, reasoningEngine,
  agentOrchestrator, permissionsEngine, contextEngine, contextEngineV2,
  worldModel, goalManager, reflectionEngine, skillManager, pluginMarketplace,
  tracer, securityManager, providerManager, eventBusV2, sdk,
  mcpManager, mcpServer, mcpToolAdapter, mcpPermission, mcpResourceManager,
};

export async function initAinoriaCore() {
  if (initialized) return;
  log.info('Initialisation du noyau AINORIA V2...');

  const start = Date.now();
  await permissionsEngine.init();
  registerAllWATools();
  await memoryEngine.init();
  await contextEngine.init();
  await contextEngineV2.init();
  await worldModel.init();
  await goalManager.init();
  await reflectionEngine.init();
  await skillManager.init();
  await pluginMarketplace.init();
  await agentOrchestrator.init();
  providerManager.init();
  await tracer.init();
  await securityManager.init();
  eventBusV2.init();

  try {
    await mcpManager.init();
    if (mcpManager.enabled) {
      mcpServer.registerTools(toolEngine.list('mcp', 'native'));
      const mcpStatus = mcpManager.getStats();
      log.info(`MCP: ${mcpStatus.servers} serveurs, ${mcpStatus.totalTools} outils`);
    }
  } catch (err) {
    log.warn(`Init MCP: ${err.message} (mode dégradé)`);
  }

  eventBusV2.emit('core:ready', { version: '2.0', startupTime: Date.now() - start });
  initialized = true;
  log.info(`Noyau AINORIA V2 pret — ${toolEngine.list().length} outils, ${agentOrchestrator.list().length} agents, ${skillManager.list().length} skills (${Date.now() - start}ms)`);
}

export async function handleMessage(message, context = {}) {
  if (!initialized) await initAinoriaCore();
  const jid = context.jid || context.from || 'unknown';

  return tracer.traceOperation('handle_message', async (trace) => {
    securityManager.checkRateLimit(`user:${jid}`);
    securityManager.audit('message', { actor: jid, detail: typeof message === 'string' ? message.slice(0, 100) : 'object', resource: 'ainoria' });

    memoryEngine.storeShortTerm(jid, 'last_message', {
      text: typeof message === 'string' ? message.slice(0, 500) : JSON.stringify(message).slice(0, 500),
      timestamp: Date.now(),
    });

    const ctx = await contextEngineV2.buildContext(message, context);
    const result = await agentOrchestrator.route(message, { ...context, enrichedContext: ctx });

    reflectionEngine.record('handle_message', null, result, {
      toolsUsed: [result.tool].filter(Boolean),
      autoAnalyze: result.type === 'plan_executed',
    }).catch(() => {});

    eventBusV2.emitSync('message:processed', { jid, resultType: result.type });
    return result;
  }, { agent: context.agentName, tool: null });
}

export function getCoreStatus() {
  return {
    initialized,
    version: '2.0',
    aiRouter: aiRouter.getStats(),
    providerManager: providerManager.getStats(),
    memory: memoryEngine.getStats(),
    tool: toolEngine.getStats(),
    planning: planningEngine.getStats(),
    reasoning: reasoningEngine.getStats(),
    agents: agentOrchestrator.getStats(),
    permissions: permissionsEngine.initialized,
    context: contextEngine.getStats(),
    contextV2: contextEngineV2.getStats(),
    world: worldModel.getStats(),
    goals: goalManager.getStats(),
    reflections: reflectionEngine.getStats(),
    skills: skillManager.getStats(),
    plugins: pluginMarketplace.getStats(),
    tracer: tracer.getStats(),
    security: securityManager.getStats(),
    eventBus: eventBusV2.getStats(),
    toolsCount: toolEngine.list().length,
    mcp: mcpManager.getStats(),
  };
}

export default {
  initAinoriaCore, handleMessage, getCoreStatus,
  aiRouter, memoryEngine, toolEngine, planningEngine, reasoningEngine,
  agentOrchestrator, permissionsEngine, contextEngine, contextEngineV2,
  worldModel, goalManager, reflectionEngine, skillManager, pluginMarketplace,
  tracer, securityManager, providerManager, eventBusV2, sdk,
  mcpManager, mcpServer, mcpToolAdapter, mcpPermission, mcpResourceManager,
};
