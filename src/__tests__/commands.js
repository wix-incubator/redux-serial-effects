/* eslint-env jest */
'use strict'

const {
  createImmediateCmd,
  createQueuedCmd,
  isImmediateCommand,
  isQueuedCommand
} = require('../index')

describe('commands', function() {
  describe('createImmediateCmd', function() {
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
  })

  describe('createQueuedCmd', function() {
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

  describe('isImmediateCommand', function() {
    test('should return true for an immediate command', function() {
      const immediateCommand = createImmediateCmd(
        'testExecutorType',
        {
          type: 'testCommandType',
          testProperty: 'someString'
        },
        'testMessageType'
      )
      expect(isImmediateCommand(immediateCommand)).toBe(true)
    })

    test('should return false for a queued command', function() {
      const queuedCommand = createQueuedCmd(
        'testExecutorType',
        {
          type: 'testCommandType',
          testProperty: 'someString'
        },
        'testMessageType'
      )
      expect(isImmediateCommand(queuedCommand)).toBe(false)
    })

    test('should return false for non commands', function() {
      const nothing = null
      const commandWithoutType = {
        isQueued: false,
        command: { type: 'test' },
        actionType: 'testMessageType'
      }
      const commandWithoutIsQueued = {
        type: 'testExecutorType',
        command: { type: 'test' },
        actionType: 'testMessageType'
      }
      expect(isImmediateCommand(nothing)).toBe(false)
      expect(isImmediateCommand(commandWithoutType)).toBe(false)
      expect(isImmediateCommand(commandWithoutIsQueued)).toBe(false)
    })
  })

  describe('isQueuedCommand', function() {
    test('should return false for an immediate command', function() {
      const immediateCommand = createImmediateCmd(
        'testExecutorType',
        {
          type: 'testCommandType',
          testProperty: 'someString'
        },
        'testMessageType'
      )
      expect(isQueuedCommand(immediateCommand)).toBe(false)
    })

    test('should return true for a queued command', function() {
      const queuedCommand = createQueuedCmd(
        'testExecutorType',
        {
          type: 'testCommandType',
          testProperty: 'someString'
        },
        'testMessageType'
      )
      expect(isQueuedCommand(queuedCommand)).toBe(true)
    })

    test('should return false for non commands', function() {
      const nothing = null
      const commandWithoutType = {
        isQueued: false,
        command: { type: 'test' },
        actionType: 'testMessageType'
      }
      const commandWithoutIsQueued = {
        type: 'testExecutorType',
        command: { type: 'test' },
        actionType: 'testMessageType'
      }
      expect(isQueuedCommand(nothing)).toBe(false)
      expect(isQueuedCommand(commandWithoutType)).toBe(false)
      expect(isQueuedCommand(commandWithoutIsQueued)).toBe(false)
    })
  })
})
