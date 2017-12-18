'use strict'

const createCmd = require('./base')

const TYPE = 'DISPATCH'

const create = action => {
  return createCmd(action.type, TYPE, false, {
    action,
    run: dispatch => dispatch(action)
  })
}

module.exports.type = TYPE
module.exports.create = create
