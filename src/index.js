'use strict'

const createMiddleware = require('./middleware')
const combineSubscribers = require('./combineSubscribers')
const { match: matchAction } = require('./action')

module.exports = {
  createMiddleware,
  combineSubscribers,
  matchAction
}
