'use strict';

const fs = require('fs');
const path = require('path');

const WORKFLOW_DIR = path.join(__dirname, '..', '..', 'data', 'workflows');

function listWorkflows() {
  try {
    fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
    return fs.readdirSync(WORKFLOW_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf-8'));
          return { name: data.name || f.replace('.json', ''), description: data.description || '' };
        } catch (_) {
          return { name: f.replace('.json', ''), description: '' };
        }
      });
  } catch (_) {
    return [];
  }
}

async function runWorkflow(name, vars = {}) {
  const filePath = path.join(WORKFLOW_DIR, name + '.json');
  if (!fs.existsSync(filePath)) {
    return { output: `❌ Workflow "${name}" non trouvé. Disponibles: ${listWorkflows().map(w => w.name).join(', ') || 'aucun'}` };
  }
  try {
    const wf = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let output = `⚙️ *Workflow: ${wf.name || name}*\n\n`;
    output += wf.description ? wf.description + '\n\n' : '';
    output += `📋 Étapes: ${wf.steps?.length || 0}\n`;
    output += `🔧 Variables: ${Object.keys(vars).join(', ') || 'aucune'}\n\n`;
    output += `_Workflow chargé. Exécution complète nécessite un moteur d'orchestration._`;
    return { output };
  } catch (e) {
    return { output: `❌ Erreur workflow: ${e.message}` };
  }
}

module.exports = { listWorkflows, runWorkflow };
