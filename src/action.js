// @flow
'use strict'

const { Either } = require('./utils/either')

import type { EitherPattern } from './utils/either'

type SuccessAction = {
  type: string,
  error?: false,
  payload: *
}

type FailureAction = {
  type: string,
  error: true,
  payload: Error
}

type Action = SuccessAction | FailureAction

const fromError = (type: string, error: Error): Action => ({
  type,
  error: true,
  payload: error
})

const fromSuccess = <T: *>(type: string, value: T): Action => ({
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

const match = <T>(action: Action, patterns: EitherPattern<Error, *, T>): T => {
  return toEither(action).match(patterns)
}

module.exports = {
  fromError,
  fromSuccess,
  match
}
