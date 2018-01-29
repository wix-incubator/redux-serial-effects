'use strict'

const { createImmediateCmd, createQueuedCmd } = require('../../src/index')

const { type: executorType } = require('./executor')
const {
  QUEUED_DELAYED_VALUE_CMD,
  QUEUED_DELAYED_REJECT_CMD,
  QUEUED_REJECT_CMD,
  QUEUED_THROW_CMD,
  IMMEDIATE_VALUE_CMD,
  IMMEDIATE_THROW_CMD,
  IMMEDIATE_REJECT_CMD
} = require('./commandTypes')

const queuedDelayedValueCmd = (delay, value, actionType) =>
  createQueuedCmd(
    executorType,
    {
      type: QUEUED_DELAYED_VALUE_CMD,
      delay,
      value
    },
    actionType
  )

const queuedDelayedRejectCmd = (delay, error, actionType) =>
  createQueuedCmd(
    executorType,
    {
      type: QUEUED_DELAYED_REJECT_CMD,
      delay,
      error
    },
    actionType
  )

const queuedRejectCmd = (error, actionType) =>
  createQueuedCmd(
    executorType,
    {
      type: QUEUED_REJECT_CMD,
      error
    },
    actionType
  )

const queuedThrowCmd = (error, actionType) =>
  createQueuedCmd(
    executorType,
    {
      type: QUEUED_THROW_CMD,
      error
    },
    actionType
  )

const immediateValueCmd = (value, actionType) =>
  createImmediateCmd(
    executorType,
    {
      type: IMMEDIATE_VALUE_CMD,
      value
    },
    actionType
  )

const immediateThrowCmd = (error, actionType) =>
  createImmediateCmd(
    executorType,
    {
      type: IMMEDIATE_THROW_CMD,
      error
    },
    actionType
  )

const immediateRejectCmd = (error, actionType) =>
  createImmediateCmd(
    executorType,
    {
      type: IMMEDIATE_REJECT_CMD,
      error
    },
    actionType
  )

module.exports.queuedDelayedValueCmd = queuedDelayedValueCmd
module.exports.queuedDelayedRejectCmd = queuedDelayedRejectCmd
module.exports.queuedRejectCmd = queuedRejectCmd
module.exports.queuedThrowCmd = queuedThrowCmd
module.exports.immediateValueCmd = immediateValueCmd
module.exports.immediateThrowCmd = immediateThrowCmd
module.exports.immediateRejectCmd = immediateRejectCmd
