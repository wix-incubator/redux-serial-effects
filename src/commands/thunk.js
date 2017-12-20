'use strict'

const createCmd = require('./base')

const THUNK_TYPE = 'THUNK'

const thunkProvider = extraArgument => ({
  type: THUNK_TYPE,
  runner: cmd => cmd.run(extraArgument)
})

const thunkCmd = isQueued => fn =>
  createCmd(THUNK_TYPE, isQueued, {
    run: extraArgument => fn(extraArgument)
  })

const immediateThunkCmd = thunkCmd(false)
const queuedThunkCmd = thunkCmd(true)

module.exports.provider = thunkProvider
module.exports.immediateThunkCmd = immediateThunkCmd
module.exports.queuedThunkCmd = queuedThunkCmd
