import { CognitiveAgent, AgentOrchestrator, orchestrator as _orchestrator, AGENT_STATES } from './agent-framework.js';
import { executive as _executive, ExecutiveAgent } from './executive-agent.js';
import { research as _research, ResearchAgent } from './research-agent.js';
import { communication as _communication, CommunicationAgent } from './communication-agent.js';
import { learning as _learning, LearningAgent } from './learning-agent.js';

export { CognitiveAgent, AgentOrchestrator, AGENT_STATES, ExecutiveAgent, ResearchAgent, CommunicationAgent, LearningAgent };

export const orchestrator = _orchestrator;
export const executive = _executive;
export const research = _research;
export const communication = _communication;
export const learning = _learning;

export async function initAgents() {
  orchestrator.register(executive);
  orchestrator.register(research);
  orchestrator.register(communication);
  orchestrator.register(learning);

  await orchestrator.startAll();
  return orchestrator;
}

export default {
  orchestrator,
  executive,
  research,
  communication,
  learning,
  initAgents,
};
