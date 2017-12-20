'use strict'

const create = (type, isQueued, options) =>
  Object.assign({}, options, { type, isQueued })

module.exports = create
