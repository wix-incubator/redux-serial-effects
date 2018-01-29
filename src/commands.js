'use strict'

const create = (type, isQueued, command, actionType) =>
  Object.assign({}, { type, isQueued, command, actionType })

const createImmediateCmd = (type, command, actionType) =>
  create(type, false, command, actionType)

const createQueuedCmd = (type, command, actionType) =>
  create(type, true, command, actionType)

module.exports.createImmediateCmd = createImmediateCmd
module.exports.createQueuedCmd = createQueuedCmd
