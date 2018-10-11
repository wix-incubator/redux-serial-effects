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

module.exports = {
  createMiddleware,
  combineSubscribers,
  createImmediateCmd,
  createQueuedCmd,
  isImmediateCommand,
  isQueuedCommand,
  matchAction
}
