'use strict'

const { Either } = require('./utils/either')

const fromError = (type, error) => ({
  type,
  payload: { error }
})
const fromSuccess = (type, value) => ({
  type,
  payload: { ok: value }
})

const toEither = payload => {
  if (payload.error !== undefined) {
    return Either.Left(payload.error)
  } else {
    return Either.Right(payload.ok)
  }
}

const match = (action, patterns) => {
  return toEither(action.payload).match(patterns)
}

module.exports.fromError = fromError
module.exports.fromSuccess = fromSuccess
module.exports.match = match
