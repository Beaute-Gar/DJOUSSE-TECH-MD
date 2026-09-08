import { createLogger } from '../../infrastructure/logger.js';
import { RealDbService, RealLlmService, RealWhatsappService, RealSchedulerService, setSockRef } from './djousse-services.js';
import { VirtualFileSystem } from './virtual-filesystem.js';
import { LearningLoop } from './learning-loop.js';
import { ContextOptimizer } from './context-optimizer.js';
import { ActionInterpreter } from './action-interpreter.js';
import { AutonomousPlanner } from './autonomous-planner.js';

const log = createLogger('DJOUSSE-INIT');

let _initialized = false;
let _services = null;

function _init() {
  if (_initialized && _services) return _services;
  log.info('Initialisation des modules DJOUSSE TECH...');
  const dbService = new RealDbService();
  const llmService = new RealLlmService();
  const whatsappService = new RealWhatsappService(null);
  const schedulerService = new RealSchedulerService();

  const vfsService = new VirtualFileSystem(dbService);
  const learningLoop = new LearningLoop(dbService, llmService, whatsappService);
  const contextOptimizer = new ContextOptimizer(dbService, llmService);
  const autonomousPlanner = new AutonomousPlanner(dbService, llmService, schedulerService);
  const actionInterpreter = new ActionInterpreter(llmService, whatsappService, vfsService, learningLoop, schedulerService);

  _services = { dbService, llmService, whatsappService, schedulerService, vfsService, learningLoop, contextOptimizer, autonomousPlanner, actionInterpreter };
  _initialized = true;
  log.info('Modules DJOUSSE TECH initialisés');
  return _services;
}

export function setSock(sock) {
  setSockRef(sock);
  if (_services) _services.whatsappService.setSock(sock);
}

export function getServices() {
  return _init();
}

export function getActionInterpreter() {
  return _init().actionInterpreter;
}

export function getVfsService() {
  return _init().vfsService;
}

export function getLearningLoop() {
  return _init().learningLoop;
}

export function getContextOptimizer() {
  return _init().contextOptimizer;
}

export function getAutonomousPlanner() {
  return _init().autonomousPlanner;
}
