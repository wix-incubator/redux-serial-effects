'use strict'

const create = (type, isQueued, command, actionType) =>
  Object.assign({}, { type, isQueued, command, actionType })

const createImmediateCmd = (type, command, actionType) =>
  create(type, false, command, actionType)

const createQueuedCmd = (type, command, actionType) =>
  create(type, true, command, actionType)

const isCommand = maybeCommand =>
  maybeCommand != null &&
  typeof maybeCommand.isQueued === 'boolean' &&
  typeof maybeCommand.type === 'string'

const isImmediateCommand = maybeCommand =>
  isCommand(maybeCommand) && !maybeCommand.isQueued

const isQueuedCommand = maybeCommand =>
  isCommand(maybeCommand) && maybeCommand.isQueued

module.exports.createImmediateCmd = createImmediateCmd
module.exports.createQueuedCmd = createQueuedCmd
module.exports.isCommand = isCommand
module.exports.isImmediateCommand = isImmediateCommand
module.exports.isQueuedCommand = isQueuedCommand
