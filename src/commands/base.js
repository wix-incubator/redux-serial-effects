'use strict'

const create = (name, type, isQueued, options) =>
  Object.assign({}, options, { name, type, isQueued })

module.exports = create
