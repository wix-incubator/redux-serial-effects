'use strict'

const isPromise = maybePromise =>
  maybePromise != null && typeof maybePromise.then === 'function'

module.exports.isPromise = isPromise
