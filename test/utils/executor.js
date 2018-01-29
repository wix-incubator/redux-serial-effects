'use strict'

const {
  QUEUED_DELAYED_VALUE_CMD,
  QUEUED_DELAYED_REJECT_CMD,
  QUEUED_REJECT_CMD,
  QUEUED_THROW_CMD,
  IMMEDIATE_VALUE_CMD,
  IMMEDIATE_THROW_CMD,
  IMMEDIATE_REJECT_CMD
} = require('./commandTypes')

const type = 'TEST_EXECUTOR'

const createExecutor = extraArgument => ({
  type,
  execute: cmd => {
    switch (cmd.type) {
      case QUEUED_DELAYED_VALUE_CMD: {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve(cmd.value)
          }, cmd.delay)
        })
      }
      case QUEUED_DELAYED_REJECT_CMD: {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error(cmd.error))
          }, cmd.delay)
        })
      }
      case QUEUED_REJECT_CMD: {
        return Promise.reject(cmd.error)
      }
      case QUEUED_THROW_CMD: {
        throw new Error(cmd.error)
      }
      case IMMEDIATE_VALUE_CMD: {
        return cmd.value
      }
      case IMMEDIATE_THROW_CMD: {
        throw new Error(cmd.error)
      }
      case IMMEDIATE_REJECT_CMD: {
        return Promise.reject(cmd.error)
      }
    }
  }
})

module.exports.type = type
module.exports.createExecutor = createExecutor
