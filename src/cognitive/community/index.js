export { communityStore } from './community-store.js';
export { registerGroupProfiler } from './group-profiler.js';
export { registerPollManager, handleCreatePoll, handleVote, handleSetMandatory } from './poll-manager.js';
export { registerCommunityGames, handleStartQuiz, handleStartDevinette, handleClassement } from './community-games.js';
export { registerModes, handleSetMode, handleGetMode } from './modes.js';
export { registerAutoSummary } from './auto-summary.js';

export function registerCommunityPlugin(pipeline) {
  registerGroupProfiler(pipeline);
  registerPollManager(pipeline);
  registerCommunityGames(pipeline);
  registerModes(pipeline);
  registerAutoSummary(pipeline);
}
