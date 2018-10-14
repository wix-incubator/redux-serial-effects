'use strict'

const createMiddleware = require('./middleware')
const { match: matchAction } = require('./action')

module.exports = {
  createMiddleware,
  matchAction
}
