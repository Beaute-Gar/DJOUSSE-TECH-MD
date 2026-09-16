let enabled = false;
let auditLog = [];

function getModeration() {
  return {
    get enabled() { return enabled; },
    get auditLog() { return auditLog; },
    setEnabled(val) { enabled = Boolean(val); },
    getAuditLog(limit = 20) { return auditLog.slice(-limit); },
    log(event, userId, reason) {
      auditLog.push({ event, userId, reason, timestamp: new Date().toISOString() });
      if (auditLog.length > 200) auditLog = auditLog.slice(-200);
    },
  };
}

module.exports = { getModeration };
