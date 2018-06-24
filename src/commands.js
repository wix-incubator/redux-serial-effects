// @flow
'use strict'

export type Command = {
  type: string,
  command: {},
  actionType: string,
  isQueued: boolean
}

const create = (type, isQueued, command, actionType): Command =>
  Object.assign({}, { type, isQueued, command, actionType })

const createImmediateCmd = (type: string, command: {}, actionType: string) =>
  create(type, false, command, actionType)

const createQueuedCmd = (type: string, command: {}, actionType: string) =>
  create(type, true, command, actionType)

const isCommand = (maybeCommand: any) =>
  maybeCommand != null &&
  typeof maybeCommand.isQueued === 'boolean' &&
  typeof maybeCommand.type === 'string'

const isImmediateCommand = (maybeCommand: any): boolean =>
  isCommand(maybeCommand) && !maybeCommand.isQueued

const isQueuedCommand = (maybeCommand: any): boolean =>
  isCommand(maybeCommand) && maybeCommand.isQueued

module.exports = {
  createImmediateCmd,
  createQueuedCmd,
  isCommand,
  isImmediateCommand,
  isQueuedCommand
}
