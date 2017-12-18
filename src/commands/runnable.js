'use strict'

const { isPromise } = require('../utils/isPromise')

const createCmd = require('./base')

const TYPE = 'CALLABLE'

const create = isQueued => (f, { args = [], name = '' } = {}) => {
  return createCmd(name, TYPE, isQueued, {
    run: () => {
      const result = f(...args)
      if (isQueued || !isPromise(result)) {
        return result
      }
    }
  })
}

module.exports.type = TYPE
module.exports.createImmediateRunCmd = create(false)
module.exports.createQueuedRunCmd = create(true)
