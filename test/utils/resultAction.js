'use strict'

const { Either } = require('./either')

const toEither = action => {
  if (action.error === true) {
    return Either.Left(action.payload)
  } else {
    return Either.Right(action.payload)
  }
}

const match = (action, patterns) => {
  return toEither(action).match(patterns)
}

const creatorWithType = type =>
  type ? (error, payload) => ({ type, error, payload }) : undefined

module.exports = {
  match,
  creatorWithType
}
