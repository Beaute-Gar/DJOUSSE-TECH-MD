'use strict';
const { LudoManager } = require('./manager');
const engine = require('./engine');
const board = require('./board');
const render = require('./render');
const config = require('./config');

/** Crée un gestionnaire de parties (une instance suffit pour tous les chats). */
const createLudo = (options) => new LudoManager(options);

module.exports = { createLudo, LudoManager, engine, board, render, config };
