/* eslint-env jest */
'use strict'

const { createImmediateCmd, createQueuedCmd } = require('../commands')

describe('base service', function() {
  test('should return an immediate command object with the correct properties', function() {
    expect(
      createImmediateCmd(
        'testExecutorType',
        {
          type: 'testCommandType',
          testProperty: 'someString'
        },
        'testMessageType'
      )
    ).toMatchObject({
      type: 'testExecutorType',
      isQueued: false,
      actionType: 'testMessageType',
      command: {
        type: 'testCommandType',
        testProperty: 'someString'
      }
    })
  })

  test('should return a queued command object with the correct properties', function() {
    expect(
      createQueuedCmd(
        'testExecutorType',
        {
          type: 'testCommandType',
          testProperty: 'someString'
        },
        'testMessageType'
      )
    ).toMatchObject({
      type: 'testExecutorType',
      isQueued: true,
      actionType: 'testMessageType',
      command: {
        type: 'testCommandType',

        testProperty: 'someString'
      }
    })
  })
})
