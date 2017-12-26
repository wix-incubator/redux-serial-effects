'use strict'

const serialEffectsMiddleware = require('./middleware')
const combineSubscribers = require('./combineSubscribers')
const {
  create: dispatchCmd,
  provider: dispatchProvider
} = require('./commands/dispatch')
const {
  immediateThunkCmd,
  queuedThunkCmd,
  provider: thunkProvider
} = require('./commands/thunk')
const createCmd = require('./commands/base')

module.exports.serialEffectsMiddleware = serialEffectsMiddleware
module.exports.combineSubscribers = combineSubscribers

module.exports.createCmd = createCmd

module.exports.dispatchCmd = dispatchCmd
module.exports.dispatchProvider = dispatchProvider

module.exports.immediateThunkCmd = immediateThunkCmd
module.exports.queuedThunkCmd = queuedThunkCmd
module.exports.thunkProvider = thunkProvider
