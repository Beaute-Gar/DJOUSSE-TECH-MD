const sudoNumbers = new Set();

function isSudo(number) { return sudoNumbers.has(String(number).replace(/[^0-9]/g, '')); }
function addSudo(number) { sudoNumbers.add(String(number).replace(/[^0-9]/g, '')); }
function removeSudo(number) { return sudoNumbers.delete(String(number).replace(/[^0-9]/g, '')); }
function listSudo() { return Array.from(sudoNumbers); }

module.exports = { sudoNumbers, isSudo, addSudo, removeSudo, listSudo };
