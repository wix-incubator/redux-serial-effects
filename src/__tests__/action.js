'use strict'

const action = require('../action')

const ACTION_TYPE = 'TEST_ACTION'

const id = _ => _

describe('action', function() {
  test('create a correct error state', function() {
    const errorAction = action.fromError(ACTION_TYPE, 'error text')
    expect(errorAction).toEqual({
      type: ACTION_TYPE,
      error: true,
      payload: 'error text'
    })
  })

  test('create a correct success state', function() {
    const successAction = action.fromSuccess(ACTION_TYPE, 'success text')
    expect(successAction).toEqual({
      type: ACTION_TYPE,
      payload: 'success text'
    })
  })

  describe('pattern match', function() {
    test('should match an error action to Error pattern', function() {
      const errorAction = action.fromError(ACTION_TYPE, 'error text')
      expect(action.match(errorAction, { Error: id, Ok: () => {} })).toEqual(
        'error text'
      )
    })

    test('should match a success action to Ok pattern', function() {
      const successAction = action.fromSuccess(ACTION_TYPE, 'success text')
      expect(action.match(successAction, { Error: () => {}, Ok: id })).toEqual(
        'success text'
      )
    })

    describe('default patterns', function() {
      test('should default to an empty function if Error pattern is not available', function() {
        const errorAction = action.fromError(ACTION_TYPE, 'error text')
        expect(
          action.match(errorAction, { Ok: () => 'success text' })
        ).toBeUndefined()
      })

      test('should default to an empty function if Ok pattern is not available', function() {
        const successAction = action.fromSuccess(ACTION_TYPE, 'success text')
        expect(
          action.match(successAction, { Error: () => 'error text' })
        ).toBeUndefined()
      })
    })
  })
})
