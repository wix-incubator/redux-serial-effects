'use strict'

const create = (name, type, isAsync, options) =>
  Object.assign({}, options, { name, type, isAsync })

module.exports = create
