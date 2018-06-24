// @flow
'use strict'

const isPromise = (maybePromise: ?Promise<*>) =>
  maybePromise != null && typeof maybePromise.then === 'function'

module.exports.isPromise = isPromise
