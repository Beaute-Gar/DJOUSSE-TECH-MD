const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const fs = require('fs');
const path = require('path');

const TODO_DIR = path.join(__dirname, '..', 'data', 'todos');

function getTodoFile(chat) {
  return path.join(TODO_DIR, (chat || 'default').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
}

function loadTodos(chat) {
  try {
    fs.mkdirSync(TODO_DIR, { recursive: true });
    const f = getTodoFile(chat);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : [];
  } catch {
    return [];
  }
}

function saveTodos(chat, todos) {
  fs.mkdirSync(TODO_DIR, { recursive: true });
  fs.writeFileSync(getTodoFile(chat), JSON.stringify(todos, null, 2));
}

cmd({
  pattern: 'todo',
  alias: ['todolist', 'tasks', 'taches'],
  desc: 'Gérer la todo list du groupe',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply, sender }) => {
  const todos = loadTodos(m.chat);

  if (!q) {
    const lines = todos.length
      ? todos.map((t, i) => {
          const check = t.done ? '✅' : '⬜';
          const by = t.done ? ` (par ${t.doneBy?.split('@')[0] || '?'})` : '';
          return `${check} ${i + 1}. ${t.text}${by}`;
        }).join('\n')
      : 'Aucune tâche. Ajoute avec: .todo add <tâche>';
    return reply(box('📝 *TODO LIST — ' + todos.filter(t => !t.done).length + ' restantes*', [
      { raw: lines || 'Liste vide ✨' },
    ]));
  }

  const [action, ...rest] = q.trim().split(/\s+/);
  const text = rest.join(' ').trim();

  switch (action.toLowerCase()) {
    case 'add':
    case 'a':
    case '+': {
      if (!text) return reply('❌ Usage: .todo add <tâche>');
      todos.push({ text, done: false, createdBy: sender, created: Date.now() });
      saveTodos(m.chat, todos);
      await m.react('📝');
      return reply(`✅ Tâche ajoutée: *${text}*\n${todos.length} tâche(s) au total.`);
    }

    case 'done':
    case 'd':
    case 'x': {
      const idx = parseInt(text) - 1;
      if (isNaN(idx) || idx < 0 || idx >= todos.length) return reply('❌ Numéro invalide. Utilise `.todo` pour voir la liste.');
      todos[idx].done = true;
      todos[idx].doneBy = sender;
      todos[idx].doneAt = Date.now();
      saveTodos(m.chat, todos);
      await m.react('✅');
      return reply(`✅ Tâche *${todos[idx].text}* marquée comme terminée !`);
    }

    case 'undone':
    case 'u': {
      const idx = parseInt(text) - 1;
      if (isNaN(idx) || idx < 0 || idx >= todos.length) return reply('❌ Numéro invalide.');
      todos[idx].done = false;
      delete todos[idx].doneBy;
      delete todos[idx].doneAt;
      saveTodos(m.chat, todos);
      return reply(`⬜ Tâche *${todos[idx].text}* réactivée.`);
    }

    case 'del':
    case 'rm':
    case 'remove':
    case 'delete': {
      const idx = parseInt(text) - 1;
      if (isNaN(idx) || idx < 0 || idx >= todos.length) return reply('❌ Numéro invalide.');
      const removed = todos.splice(idx, 1)[0];
      saveTodos(m.chat, todos);
      return reply(`🗑️ Tâche supprimée: *${removed.text}*`);
    }

    case 'clear': {
      const done = todos.filter(t => t.done);
      if (!done.length) return reply('Aucune tâche terminée à supprimer.');
      const remaining = todos.filter(t => !t.done);
      saveTodos(m.chat, remaining);
      return reply(`🗑️ ${done.length} tâche(s) terminée(s) supprimée(s). ${remaining.length} restante(s).`);
    }

    default: {
      return reply(box('📝 *TODO LIST — COMMANDES*', [
        { label: '.todo add <texte>', value: 'Ajouter une tâche' },
        { label: '.todo done <n°>', value: 'Marquer terminée' },
        { label: '.todo undone <n°>', value: 'Réactiver' },
        { label: '.todo del <n°>', value: 'Supprimer' },
        { label: '.todo clear', value: 'Supprimer les terminées' },
        { label: '.todo', value: 'Voir la liste' },
      ]));
    }
  }
});
