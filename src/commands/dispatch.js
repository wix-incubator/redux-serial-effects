'use strict'

const createCmd = require('./base')

const TYPE = 'DISPATCH'

const create = action => {
  return createCmd(TYPE, false, {
    action
  })
}

const provider = dispatch => ({
  type: TYPE,
  runner: command => dispatch(command.action)
})

module.exports.create = create
module.exports.provider = provider
