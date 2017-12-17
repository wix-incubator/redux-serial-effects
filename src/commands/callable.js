'use strict'

const createCmd = require('./base')

const TYPE = 'CALLABLE'

const create = (isAsync, f, { args = [], name = '' } = {}) => {
  return createCmd(name, TYPE, isAsync, {
    run: () => f(...args)
  })
}

module.exports.type = TYPE
module.exports.create = create
