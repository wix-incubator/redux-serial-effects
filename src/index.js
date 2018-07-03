'use strict'

const createMiddleware = require('./middleware')
const combineSubscribers = require('./combineSubscribers')
const {
  createImmediateCmd,
  createQueuedCmd,
  isImmediateCommand,
  isQueuedCommand
} = require('./commands')
const { match: matchAction } = require('./action')

module.exports.createMiddleware = createMiddleware
module.exports.combineSubscribers = combineSubscribers
module.exports.createImmediateCmd = createImmediateCmd
module.exports.createQueuedCmd = createQueuedCmd
module.exports.isImmediateCommand = isImmediateCommand
module.exports.isQueuedCommand = isQueuedCommand
module.exports.matchAction = matchAction
