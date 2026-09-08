let _traceCounter = 0;

export function createPipelineContext(messageId, jid, senderJid) {
  _traceCounter++;
  const state = {
    traceId: `trace_${Date.now()}_${_traceCounter}`,
    messageId: messageId || `msg_${Date.now()}`,
    jid,
    senderJid,
    pipeline: 'PASS',
    mentionDetected: false,
    cmMentionAttempted: false,
    cmMentionSent: false,
    orchestratorAttempted: false,
    orchestratorSent: false,
    llmCalls: 0,
    startTime: Date.now(),
  };

  return {
    state,
    setPipeline(value) { state.pipeline = value; },
    isHandled() { return state.pipeline !== 'PASS'; },
    isFinal() { return state.pipeline === 'CM_HANDLED' || state.pipeline === 'ORCHESTRATOR_SENT'; },
    markCmHandled(sent) {
      state.pipeline = 'CM_HANDLED';
      state.cmMentionAttempted = true;
      state.cmMentionSent = sent;
    },
    markOrchestratorSent() {
      state.pipeline = 'ORCHESTRATOR_SENT';
      state.orchestratorAttempted = true;
      state.orchestratorSent = true;
    },
    markMentionDetected() { state.mentionDetected = true; },
    incLlmCalls() { state.llmCalls++; },
    elapsed() { return Date.now() - state.startTime; },
  };
}
