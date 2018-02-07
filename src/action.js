'use strict'

const { Either } = require('./utils/either')

const fromError = (type, error) => ({
  type,
  error: true,
  payload: error
})
const fromSuccess = (type, value) => ({
  type,
  payload: value
})

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

module.exports.fromError = fromError
module.exports.fromSuccess = fromSuccess
module.exports.match = match
