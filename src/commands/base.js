'use strict'

const create = (type, deferred, options) =>
  Object.assign({}, options, { type, deferred })

module.exports = create
