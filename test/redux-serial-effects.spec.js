/* eslint-env jest */
'use strict'

const { createStore, applyMiddleware, combineReducers } = require('redux')

const { createMiddleware } = require('../src')

const testEffects = require('./utils/effects')
const { match: matchAction } = require('./utils/resultAction')

const SET_COUNTER = 'SET_COUNTER'
const VALUE_ACTION = 'VALUE_ACTION'
const ADD_UNDO = 'ADD_UNDO'
const EFFECT_ENDED_MSG = 'EFFECT_ENDED_MSG'

process.on('unhandledRejection', reason => {
  console.warn('Unhandled rejection:', reason) // eslint-disable-line no-console
})

process.on('uncaughtException', reason => {
  console.warn('Uncaught exception:', reason) // eslint-disable-line no-console
})

describe('middleware', function() {
  test('should change the state synchronously', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        default:
          return state
      }
    }

    const { middleware } = createMiddleware()
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    store.dispatch({ type: SET_COUNTER, value: 1 })
    store.dispatch({ type: SET_COUNTER, value: 2 })

    expect(store.getState()).toEqual({ counter: 2 })
  })

  test('should not call unsubscribed subscribers', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        default:
          return state
      }
    }

    let subscriberCalled = false
    const subscriber = ({ from, to, hasChanged }) => {
      subscriberCalled = true
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)()
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
      expect(subscriberCalled).toBe(false)
    })
  })

  test('should not break when unsubscribing an already unsubscribed subscriber', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        default:
          return state
      }
    }

    const unsubscriber = () => {
      throw new Error('unsubscribed subscriber called')
    }

    let subscriberCalled = false
    const subscriber = ({ from, to, hasChanged }) => {
      subscriberCalled = true
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const unsubscribeUnsubscriber = subscribe(unsubscriber)

    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    unsubscribeUnsubscriber()
    unsubscribeUnsubscriber()

    return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
      expect(subscriberCalled).toBe(true)
    })
  })

  test('should not call subscribers when the dispatched action does not change the state', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        default:
          return state
      }
    }

    let subscriberCalled = false
    const subscriber = ({ from, to, hasChanged }) => {
      subscriberCalled = true
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    return store.dispatch({ type: ADD_UNDO, undo: [] }).then(() => {
      expect(subscriberCalled).toBe(false)
    })
  })

  test('should handle subscribers that do not return effects', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        default:
          return state
      }
    }

    const subscriber = ({ from, to, hasChanged }) => {}

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    return expect(
      store.dispatch({ type: SET_COUNTER, value: 1 })
    ).resolves.toBeUndefined()
  })

  test('should handle subscribers that return empty effects lists', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        default:
          return state
      }
    }

    const subscriber = ({ from, to, hasChanged }) => []

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    return expect(
      store.dispatch({ type: SET_COUNTER, value: 1 })
    ).resolves.toBeUndefined()
  })

  test('should handle exceptions in subscriber code', function() {
    expect.assertions(2)

    const initialState = {
      counter: 0
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        default:
          return state
      }
    }

    let shouldThrow = true
    const subscriber = ({ from, to, hasChanged }) => {
      if (shouldThrow) {
        shouldThrow = false
        throw new Error('hardcoded exception')
      } else {
        expect(to.counter).toEqual(2)
      }
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    try {
      store.dispatch({ type: SET_COUNTER, value: 1 })
    } catch (e) {}

    return expect(
      store.dispatch({ type: SET_COUNTER, value: 2 })
    ).resolves.toBeUndefined()
  })

  test('should execute immediate effects', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0,
      resolved: false
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        case VALUE_ACTION: {
          return matchAction(action, {
            Error: error => {
              throw new Error('unexpected error:', error)
            },
            Ok: value => {
              return Object.assign({}, state, { resolved: value })
            }
          })
        }
        default:
          return state
      }
    }

    const subscriber = ({ from, to, hasChanged }) => {
      if (from.counter !== to.counter) {
        return testEffects.immediateValue(true, VALUE_ACTION)
      }
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    store.dispatch({ type: SET_COUNTER, value: 1 })
    expect(store.getState().resolved).toBe(true)
  })

  test('should execute queued effects', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0,
      resolved: false
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        case VALUE_ACTION: {
          return matchAction(action, {
            Error: () => {
              throw new Error('unexpected error')
            },
            Ok: value => {
              return Object.assign({}, state, { resolved: value })
            }
          })
        }
        default:
          return state
      }
    }

    const subscriber = ({ from, to, hasChanged }) => {
      if (from.counter !== to.counter) {
        return testEffects.queuedDelayedValue(10, true, VALUE_ACTION)
      }
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
      expect(store.getState().resolved).toBe(true)
    })
  })

  test('should execute immediate effects synchronously', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0,
      resolved: false
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        case VALUE_ACTION: {
          return matchAction(action, {
            Error: error => {
              throw new Error('unexpected error:', error)
            },
            Ok: value => {
              return Object.assign({}, state, { resolved: value })
            }
          })
        }
        default:
          return state
      }
    }

    const subscriber = ({ from, to, hasChanged }) => {
      if (from.counter !== to.counter) {
        return [
          testEffects.queuedDelayedValue('BOGUS_ACTION', 1000),
          testEffects.immediateValue(true, VALUE_ACTION)
        ]
      }
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    store.dispatch({ type: SET_COUNTER, value: 1 })
    expect(store.getState().resolved).toEqual(true)
  })

  test('should allow subscribers to return an array of effects', function() {
    expect.assertions(1)

    const FLOW_COMPLETE_MSG = 'FLOW_COMPLETE_MSG'
    const initialState = {
      counter: 0,
      undo: [],
      done: false
    }
    const reducer = (state = initialState, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        case ADD_UNDO: {
          return matchAction(action, {
            Error: error => {
              throw new Error(`unexpected error: ${error}`)
            },
            Ok: undo => {
              return Object.assign({}, state, {
                undo: state.undo.concat(undo)
              })
            }
          })
        }
        case FLOW_COMPLETE_MSG: {
          return matchAction(action, {
            Error: error => {
              throw new Error(`unexpected error: ${error}`)
            },
            Ok: done => {
              return Object.assign({}, state, {
                done
              })
            }
          })
        }
        default:
          return state
      }
    }

    const subscriber = ({ from, to, hasChanged }) => {
      if (hasChanged(state => state.counter)) {
        return [
          testEffects.immediateValue(from.counter, ADD_UNDO),
          testEffects.queuedDelayedValue(20, true, FLOW_COMPLETE_MSG)
        ]
      }
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    return store
      .dispatch({
        type: SET_COUNTER,
        value: 1
      })
      .then(() => {
        expect(store.getState()).toEqual({
          counter: 1,
          undo: [0],
          done: true
        })
      })
  })

  describe('should pass subscribers', function() {
    describe('a transition object', function() {
      test('with the previous state and the new state', function() {
        expect.assertions(1)

        const initialState = {
          counter: 0
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            default:
              return state
          }
        }

        const subscriber = states => {
          expect(states).toMatchObject({
            from: initialState,
            to: { counter: 1 }
          })
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store.dispatch({ type: SET_COUNTER, value: 1 })
      })

      describe('with a hasChanged function', function() {
        test('pre-bound to the current transition', function() {
          expect.assertions(2)

          const getCount = state => state.counter
          const getName = state => state.name

          const initialState = {
            counter: 0,
            name: 'number of tests'
          }
          const reducer = (state, action) => {
            switch (action.type) {
              case SET_COUNTER: {
                return Object.assign({}, state, { counter: action.value })
              }
              default:
                return state
            }
          }

          const subscriber = ({ from, to, hasChanged }) => {
            expect(hasChanged(getCount)).toBe(true)
            expect(hasChanged(getName)).toBe(false)
          }

          const { middleware, subscribe } = createMiddleware()
          subscribe(subscriber)
          const store = createStore(
            reducer,
            initialState,
            applyMiddleware(middleware)
          )

          return store.dispatch({ type: SET_COUNTER, value: 1 })
        })

        test('that returns true when a part of the state has changed', function() {
          expect.assertions(1)

          const getProperties = state => state.properties

          const initialState = {
            counter: 0,
            properties: {
              name: 'number of tests'
            }
          }
          const reducer = (state, action) => {
            switch (action.type) {
              case SET_COUNTER: {
                return Object.assign({}, state, { counter: action.value })
              }
              default:
                return state
            }
          }

          const subscriber = ({ from, to, hasChanged }) => {
            expect(hasChanged(getProperties)).toBe(false)
          }

          const { middleware, subscribe } = createMiddleware()
          subscribe(subscriber)
          const store = createStore(
            reducer,
            initialState,
            applyMiddleware(middleware)
          )

          return store.dispatch({ type: SET_COUNTER, value: 1 })
        })
      })

      describe('with a hasChangedToMatch function', function() {
        test('that returns true when the selected state has changed to match the predicate', function() {
          expect.assertions(1)

          const getCount = state => state.counter

          const initialState = {
            counter: 0,
            name: 'number of tests'
          }
          const reducer = (state, action) => {
            switch (action.type) {
              case SET_COUNTER: {
                return Object.assign({}, state, { counter: action.value })
              }
              default:
                return state
            }
          }

          const subscriber = ({ from, to, hasChangedToMatch }) => {
            expect(hasChangedToMatch(getCount, _ => _ === 1)).toBe(true)
          }

          const { middleware, subscribe } = createMiddleware()
          subscribe(subscriber)
          const store = createStore(
            reducer,
            initialState,
            applyMiddleware(middleware)
          )

          return store.dispatch({ type: SET_COUNTER, value: 1 })
        })

        test('that returns false when the selected state has changed and does not match the predicate', function() {
          expect.assertions(1)

          const getCount = state => state.counter

          const initialState = {
            counter: 0,
            name: 'number of tests'
          }
          const reducer = (state, action) => {
            switch (action.type) {
              case SET_COUNTER: {
                return Object.assign({}, state, { counter: action.value })
              }
              default:
                return state
            }
          }

          const subscriber = ({ from, to, hasChangedToMatch }) => {
            expect(hasChangedToMatch(getCount, _ => _ === 1)).toBe(true)
          }

          const { middleware, subscribe } = createMiddleware()
          subscribe(subscriber)
          const store = createStore(
            reducer,
            initialState,
            applyMiddleware(middleware)
          )

          return store.dispatch({ type: SET_COUNTER, value: 1 })
        })

        test('that returns false if the selected state has not changed', function() {
          expect.assertions(1)

          const getProperties = state => state.properties

          const initialState = {
            counter: 0,
            properties: {
              name: 'number of tests'
            }
          }
          const SET_NAME = 'SET_NAME'
          const reducer = (state, action) => {
            switch (action.type) {
              case SET_COUNTER: {
                return Object.assign({}, state, { counter: action.value })
              }
              case SET_NAME: {
                return Object.assign({}, state, {
                  properties: Object.assign({}, state.properties, {
                    name: action.name
                  })
                })
              }
              default:
                return state
            }
          }

          const subscriber = ({ from, to, hasChangedToMatch }) => {
            expect(
              hasChangedToMatch(getProperties, _ => _ === 'number of tests')
            ).toBe(false)
          }

          const { middleware, subscribe } = createMiddleware()
          subscribe(subscriber)
          const store = createStore(
            reducer,
            initialState,
            applyMiddleware(middleware)
          )

          return store.dispatch({ type: SET_COUNTER, value: 1 })
        })
      })
      ;[
        { matcher: 'hasChangedToTrue', matches: true },
        { matcher: 'hasChangedToFalse', matches: false },
        { matcher: 'hasChangedToNull', matches: null },
        { matcher: 'hasChangedToNotNull', matches: null, negate: true }
      ].forEach(({ matcher, matches, negate }) => {
        describe(`with a ${matcher} function`, function() {
          test(`that returns true when the selected state has changed and is ${
            negate ? 'not ' : ''
          }${matches}`, function() {
            expect.assertions(1)

            const getValue = state => state.value

            const initialState = {
              value: negate ? matches : !matches
            }
            const SET_VALUE = 'SET_VALUE'
            const reducer = (state, action) => {
              switch (action.type) {
                case SET_VALUE: {
                  return Object.assign({}, state, { value: action.value })
                }
                default:
                  return state
              }
            }

            const subscriber = transition => {
              expect(transition[matcher](getValue)).toBe(true)
            }

            const { middleware, subscribe } = createMiddleware()
            subscribe(subscriber)
            const store = createStore(
              reducer,
              initialState,
              applyMiddleware(middleware)
            )

            return store.dispatch({
              type: SET_VALUE,
              value: negate ? !matches : matches
            })
          })

          test(`that returns false if the selected state has changed and is ${
            negate ? '' : 'not '
          }${matches}`, function() {
            expect.assertions(1)

            const getValue = state => state.value

            const initialState = {
              value: negate ? !matches : matches
            }
            const SET_VALUE = 'SET_VALUE'
            const reducer = (state, action) => {
              switch (action.type) {
                case SET_VALUE: {
                  return Object.assign({}, state, { value: action.value })
                }
                default:
                  return state
              }
            }

            const subscriber = transition => {
              expect(transition[matcher](getValue)).toBe(false)
            }

            const { middleware, subscribe } = createMiddleware()
            subscribe(subscriber)
            const store = createStore(
              reducer,
              initialState,
              applyMiddleware(middleware)
            )

            return store.dispatch({
              type: SET_VALUE,
              value: negate ? matches : !matches
            })
          })

          test('that returns false if the selected state has not changed', function() {
            expect.assertions(1)

            const getValue = state => state.value

            const initialState = {
              counter: 0,
              value: matches
            }
            const SET_VALUE = 'SET_VALUE'
            const reducer = (state, action) => {
              switch (action.type) {
                case SET_COUNTER: {
                  return Object.assign({}, state, { counter: action.value })
                }
                case SET_VALUE: {
                  return Object.assign({}, state, { value: action.value })
                }
                default:
                  return state
              }
            }

            const subscriber = transition => {
              expect(transition[matcher](getValue)).toBe(false)
            }

            const { middleware, subscribe } = createMiddleware()
            subscribe(subscriber)
            const store = createStore(
              reducer,
              initialState,
              applyMiddleware(middleware)
            )

            return store.dispatch({ type: SET_COUNTER, value: 1 })
          })
        })
      })
    })
  })

  describe('when an action is not specified', function() {
    test('and an immediate effect completes successfully should not reject', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          default:
            if (state.counter > 0) {
              throw new Error('should not have received another action')
            }
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.immediateValue('some value')
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return expect(
        store.dispatch({ type: SET_COUNTER, value: 1 })
      ).resolves.toBeUndefined()
    })

    test('and an immediate effect throws an exception should rethrow the exception', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          default:
            if (state.counter > 0) {
              throw new Error('should not have received another action')
            }
            return state
        }
      }

      const errorText = 'hardcoded exception'
      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.immediateThrow(errorText)
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      expect(() => store.dispatch({ type: SET_COUNTER, value: 1 })).toThrow(
        new Error(errorText)
      )
    })

    test('and a queued effect resolves should not reject', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          default:
            if (state.counter > 0) {
              throw new Error('should not have received another action')
            }
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.queuedDelayedValue(10, 'something')
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return expect(
        store.dispatch({ type: SET_COUNTER, value: 1 })
      ).resolves.toBeUndefined()
    })

    test('and a queued effect rejects should reject with the correct error', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          default:
            if (state.counter > 0) {
              throw new Error('should not have received another action')
            }
            return state
        }
      }

      const errorText = 'hardcoded rejection'
      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.queuedDelayedReject(10, errorText)
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return store
        .dispatch({ type: SET_COUNTER, value: 1 })
        .catch(error => expect(error.message).toEqual(errorText))
    })
  })

  describe('should dispatch an action', function() {
    test('when an immediate effect completes successfully', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case EFFECT_ENDED_MSG: {
            expect(action).toEqual(expect.anything())
            return state
          }
          default:
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.immediateValue('some value', EFFECT_ENDED_MSG)
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return store.dispatch({ type: SET_COUNTER, value: 1 })
    })

    test('when an immediate effect throws an exception', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case EFFECT_ENDED_MSG: {
            expect(action).toEqual(expect.anything())
            return state
          }
          default:
            return state
        }
      }

      const errorText = 'hardcoded exception'
      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.immediateThrow(errorText, EFFECT_ENDED_MSG)
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      try {
        store.dispatch({ type: SET_COUNTER, value: 1 })
      } catch (e) {}
    })

    test('when a queued effect resolves', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case EFFECT_ENDED_MSG: {
            expect(action).toEqual(expect.anything())
            return state
          }
          default:
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.queuedDelayedValue(
            10,
            'something',
            EFFECT_ENDED_MSG
          )
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return store.dispatch({ type: SET_COUNTER, value: 1 })
    })

    test('when a queued effect rejects', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case EFFECT_ENDED_MSG: {
            expect(action).toEqual(expect.anything())
            return state
          }
          default:
            return state
        }
      }

      const errorText = 'hardcoded rejection'
      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.queuedDelayedReject(
            10,
            errorText,
            EFFECT_ENDED_MSG
          )
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return store.dispatch({ type: SET_COUNTER, value: 1 }).catch(() => {})
    })

    describe('and handle any rejections', function() {
      test('when a subsequent immediate effect throws an exception', function() {
        expect.assertions(1)

        const initialState = {
          counter: 0,
          undo: [],
          error: false
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case ADD_UNDO: {
              return matchAction(action, {
                Error: () => {
                  return Object.assign({}, state, { error: true })
                },
                Ok: undo => {
                  return Object.assign({}, state, {
                    undo: state.undo.concat(undo)
                  })
                }
              })
            }
            default:
              return state
          }
        }

        const errorText = 'hardcoded exception'
        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.immediateReject(errorText, ADD_UNDO)
          } else if (hasChanged(state => state.error)) {
            return testEffects.queuedReject(errorText, EFFECT_ENDED_MSG)
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store
          .dispatch({ type: SET_COUNTER, value: 1 })
          .then(value => expect(value).toBeUndefined())
      })

      test('when a subsequent queued effect rejects', function() {
        expect.assertions(1)

        const initialState = {
          counter: 0
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case EFFECT_ENDED_MSG: {
              expect(action).toEqual(expect.anything())
              return state
            }
            default:
              return state
          }
        }

        const errorText = 'hardcoded rejection'
        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.queuedDelayedReject(
              10,
              errorText,
              EFFECT_ENDED_MSG
            )
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store.dispatch({ type: SET_COUNTER, value: 1 }).catch(() => {})
      })
    })

    describe('with the correct payload', function() {
      test('when an immediate effect completes successfully', function() {
        expect.assertions(1)

        const initialState = {
          counter: 0,
          undo: []
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case ADD_UNDO: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: undo => {
                  return Object.assign({}, state, {
                    undo: state.undo.concat(undo)
                  })
                }
              })
            }
            default:
              return state
          }
        }

        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.immediateValue(from.counter, ADD_UNDO)
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store
          .dispatch({ type: SET_COUNTER, value: 1 })
          .then(() =>
            expect(store.getState()).toEqual({ counter: 1, undo: [0] })
          )
      })

      test('when an immediate effect throws an exception', function() {
        expect.assertions(1)

        const errorMsg = 'hardcoded exception'
        const initialState = {
          counter: 0
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case EFFECT_ENDED_MSG: {
              return matchAction(action, {
                Error: error => {
                  expect(error.message).toEqual(errorMsg)
                  return state
                },
                Ok: () => {
                  throw new Error('effect should have failed')
                }
              })
            }
            default:
              return state
          }
        }

        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.immediateThrow(errorMsg, EFFECT_ENDED_MSG)
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        try {
          store.dispatch({ type: SET_COUNTER, value: 1 })
        } catch (e) {}
      })

      test('when a queued effect resolves', function() {
        expect.assertions(1)

        const successValue = 42
        const initialState = {
          counter: 0
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case EFFECT_ENDED_MSG: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: value => {
                  expect(value).toEqual(successValue)
                  return state
                }
              })
            }
            default:
              return state
          }
        }

        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.queuedDelayedValue(
              10,
              successValue,
              EFFECT_ENDED_MSG
            )
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store.dispatch({ type: SET_COUNTER, value: 1 })
      })

      test('when a queued effect rejects', function() {
        expect.assertions(1)

        const errorMsg = 'hardcoded exception'
        const initialState = {
          counter: 0
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case EFFECT_ENDED_MSG: {
              return matchAction(action, {
                Error: error => {
                  expect(error.message).toEqual(errorMsg)
                  return state
                },
                Ok: () => {
                  throw new Error('effect should have failed')
                }
              })
            }
            default:
              return state
          }
        }

        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.queuedDelayedReject(
              10,
              errorMsg,
              EFFECT_ENDED_MSG
            )
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store.dispatch({ type: SET_COUNTER, value: 1 }).catch(() => {})
      })
    })
  })

  describe('effect execution', function() {
    test('should not wait for promises returned from immediate effects', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0,
        resolved: false
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case VALUE_ACTION: {
            return matchAction(action, {
              Error: error => {
                throw new Error('unexpected error:', error)
              },
              Ok: value => {
                return Object.assign({}, state, { resolved: value })
              }
            })
          }
          default:
            return state
        }
      }

      let resolveFirstSideEffect = undefined
      const firstSideEffectPromise = new Promise((resolve, reject) => {
        resolveFirstSideEffect = () => {
          resolve()
        }
      })

      const subscriber = ({ from, to, hasChanged }) => {
        if (to.counter === 1) {
          return testEffects.immediateValue(
            'BOGUS_ACTION',
            firstSideEffectPromise
          )
        } else if (from.counter === 1 && to.counter === 2) {
          return testEffects.queuedDelayedValue(10, true, VALUE_ACTION)
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      store.dispatch({ type: SET_COUNTER, value: 1 })
      return store
        .dispatch({ type: SET_COUNTER, value: 2 })
        .then(() => {
          expect(store.getState().resolved).toBe(true)
        })
        .then(() => {
          resolveFirstSideEffect()
        })
    })

    describe('should run queued effects only after previous effect promises have', function() {
      test('resolved', function() {
        expect.assertions(1)

        const initialState = {
          counter: 0,
          undo: [],
          resolved: false
        }

        const getCounter = state => state.counter
        const getResolved = state => state.resolved

        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case ADD_UNDO: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: undo => {
                  return Object.assign({}, state, {
                    undo: state.undo.concat(undo)
                  })
                }
              })
            }
            case VALUE_ACTION: {
              return matchAction(action, {
                Error: error => {
                  throw new Error('unexpected error:', error)
                },
                Ok: value => {
                  return Object.assign({}, state, { resolved: value })
                }
              })
            }
            default:
              return state
          }
        }

        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(getCounter)) {
            if (to.counter === 1) {
              return testEffects.queuedDelayedValue(20, from.counter, ADD_UNDO)
            } else if (to.counter === 2) {
              return testEffects.queuedDelayedValue(5, true, VALUE_ACTION)
            }
          } else if (hasChanged(getResolved)) {
            expect(to.undo).toEqual([0])
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        store.dispatch({ type: SET_COUNTER, value: 1 })
        const promise = store.dispatch({ type: SET_COUNTER, value: 2 })

        return promise
      })

      test('rejected', function() {
        expect.assertions(1)

        const initialState = {
          counter: 0,
          error: false,
          resolved: false
        }

        const getCounter = state => state.counter
        const getResolved = state => state.resolved

        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case ADD_UNDO: {
              return matchAction(action, {
                Error: () => {
                  return Object.assign({}, state, { error: true })
                },
                Ok: undo => {
                  throw new Error('the commans was expected to fail')
                }
              })
            }
            case VALUE_ACTION: {
              return matchAction(action, {
                Error: error => {
                  throw new Error('unexpected error:', error)
                },
                Ok: value => {
                  return Object.assign({}, state, { resolved: value })
                }
              })
            }
            default:
              return state
          }
        }

        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(getCounter)) {
            if (to.counter === 1) {
              return testEffects.queuedDelayedReject(20, from.counter, ADD_UNDO)
            } else if (to.counter === 2) {
              return testEffects.queuedDelayedValue(5, true, VALUE_ACTION)
            }
          } else if (hasChanged(getResolved)) {
            expect(to.error).toBe(true)
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        store.dispatch({ type: SET_COUNTER, value: 1 }).catch(() => {})
        const promise = store.dispatch({ type: SET_COUNTER, value: 2 })

        return promise
      })
    })
  })

  describe('should recover the queue after', function() {
    test('an immediate effect throws an exception', function() {
      expect.assertions(1)

      const errorText = 'hardcoded exception'
      const initialState = {
        counter: 0,
        undo: [],
        foo: undefined
      }
      const reducer = (state = initialState, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case ADD_UNDO: {
            return Object.assign({}, state, {
              undo: state.undo.concat(action.undo)
            })
          }
          case EFFECT_ENDED_MSG: {
            return matchAction(action, {
              Error: () => {
                return state
              },
              Ok: value => {
                expect(value).toEqual(expect.anything())
                return state
              }
            })
          }
          default:
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.immediateThrow(errorText, EFFECT_ENDED_MSG)
        } else if (hasChanged(state => state.undo)) {
          return testEffects.queuedDelayedValue(
            10,
            'something',
            EFFECT_ENDED_MSG
          )
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      try {
        store.dispatch({
          type: SET_COUNTER,
          value: 1
        })
      } catch (e) {}
      return store.dispatch({ type: ADD_UNDO, undo: 0 })
    })

    test('a queued effect throws an exception', function() {
      expect.assertions(1)

      const errorText = 'hardcoded exception'
      const initialState = {
        counter: 0,
        undo: [],
        foo: undefined
      }
      const reducer = (state = initialState, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case ADD_UNDO: {
            return Object.assign({}, state, {
              undo: state.undo.concat(action.undo)
            })
          }
          case EFFECT_ENDED_MSG: {
            return matchAction(action, {
              Error: () => {
                return state
              },
              Ok: value => {
                expect(value).toEqual(expect.anything())
                return state
              }
            })
          }
          default:
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.queuedThrow(errorText, EFFECT_ENDED_MSG)
        } else if (hasChanged(state => state.undo)) {
          return testEffects.queuedDelayedValue(
            10,
            'something',
            EFFECT_ENDED_MSG
          )
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return store
        .dispatch({
          type: SET_COUNTER,
          value: 1
        })
        .catch(() => {})
        .then(() => store.dispatch({ type: ADD_UNDO, undo: 0 }))
    })

    test('a queued effect rejects', function() {
      expect.assertions(2)

      const errorText = 'hardcoded exception'
      const initialState = {
        counter: 0,
        undo: [],
        foo: undefined
      }
      const reducer = (state = initialState, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case ADD_UNDO: {
            return Object.assign({}, state, {
              undo: state.undo.concat(action.undo)
            })
          }
          case EFFECT_ENDED_MSG: {
            return matchAction(action, {
              Error: () => {
                return state
              },
              Ok: value => {
                expect(value).toEqual(expect.anything())
                return state
              }
            })
          }
          default:
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.queuedDelayedReject(5, errorText, EFFECT_ENDED_MSG)
        } else if (hasChanged(state => state.undo)) {
          return testEffects.queuedDelayedValue(
            10,
            'something',
            EFFECT_ENDED_MSG
          )
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return store
        .dispatch({
          type: SET_COUNTER,
          value: 1
        })
        .catch(error => expect(error.message).toBe(errorText))
        .then(() => store.dispatch({ type: ADD_UNDO, undo: 0 }))
    })
  })
})

describe('dispatch', function() {
  test('should not return a rejected promise if an immediate effect returns a rejected promise', function() {
    expect.assertions(1)

    const initialState = {
      counter: 0
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        default:
          return state
      }
    }

    const errorText = 'hardcoded exception'
    const subscriber = () => {
      return testEffects.immediateValue(
        Promise.reject(errorText),
        EFFECT_ENDED_MSG
      )
    }

    const { middleware, subscribe } = createMiddleware()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    return store
      .dispatch({ type: SET_COUNTER, value: 1 })
      .catch(e => {
        throw new Error('this promise should not have been rejected', e)
      })
      .then(() => {
        expect(store.getState()).toEqual({ counter: 1 })
      })
  })

  describe('should throw the first exception', function() {
    test('thrown by a subscriber', function() {
      expect.assertions(1)

      const initialState = {
        counter: 0
      }
      const reducer = (state, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          default:
            return state
        }
      }

      const errorText = 'hardcoded exception'
      const subscriber = () => {
        throw new Error(errorText)
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      try {
        store.dispatch({ type: SET_COUNTER, value: 1 })
        throw new Error('exception not thrown')
      } catch (e) {
        expect(e.message).toEqual(errorText)
      }
    })

    test('thrown by an immediate effect', function() {
      expect.assertions(1)

      const errorText = 'hardcoded exception'
      const initialState = {
        counter: 0,
        undo: [],
        foo: undefined
      }
      const reducer = (state = initialState, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case EFFECT_ENDED_MSG: {
            return matchAction(action, {
              Error: () => {
                return state
              },
              Ok: value => {
                throw new Error('effect was expected to throw an exception')
              }
            })
          }
          default:
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.immediateThrow(errorText, EFFECT_ENDED_MSG)
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      expect(() =>
        store.dispatch({
          type: SET_COUNTER,
          value: 1
        })
      ).toThrow(new Error(errorText))
    })

    test('thrown by a subsequent immediate effect generated by an immediate effect', function() {
      expect.assertions(1)

      const errorText = 'hardcoded exception'
      const initialState = {
        counter: 0,
        undo: [],
        foo: undefined
      }
      const reducer = (state = initialState, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case ADD_UNDO: {
            return matchAction(action, {
              Error: error => {
                throw new Error(`unexpected error: ${error}`)
              },
              Ok: undo => {
                return Object.assign({}, state, {
                  undo: state.undo.concat(undo)
                })
              }
            })
          }
          case EFFECT_ENDED_MSG: {
            return matchAction(action, {
              Error: () => {
                return state
              },
              Ok: value => {
                throw new Error('effect was expected to throw an exception')
              }
            })
          }
          default:
            return state
        }
      }

      const subscriber = ({ from, to, hasChanged }) => {
        if (hasChanged(state => state.counter)) {
          return testEffects.immediateValue(from.counter, ADD_UNDO)
        } else if (from.undo !== to.undo) {
          return testEffects.immediateThrow(errorText, EFFECT_ENDED_MSG)
        }
      }

      const { middleware, subscribe } = createMiddleware()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      expect(() =>
        store.dispatch({
          type: SET_COUNTER,
          value: 1
        })
      ).toThrow(new Error(errorText))
    })
  })

  describe('should return a promise', function() {
    describe('that resolves', function() {
      test('when all effects of all subscribers have resolved', function() {
        expect.assertions(2)

        const FIRST_SIDE_EFFECT_MSG = 'FIRST_SIDE_EFFECT_MSG'
        const SECOND_SIDE_EFFECT_MSG = 'SECOND_SIDE_EFFECT_MSG'
        const THIRD_SIDE_EFFECT_MSG = 'THIRD_SIDE_EFFECT_MSG'
        const FOURTH_SIDE_EFFECT_MSG = 'FOURTH_SIDE_EFFECT_MSG'
        const initialState = {
          counter: 0,
          firstAction: false,
          secondAction: false,
          thirdAction: false,
          fourthAction: false
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case FIRST_SIDE_EFFECT_MSG: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: () => {
                  return Object.assign({}, state, { firstAction: true })
                }
              })
            }
            case SECOND_SIDE_EFFECT_MSG: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: () => {
                  return Object.assign({}, state, { secondAction: true })
                }
              })
            }
            case THIRD_SIDE_EFFECT_MSG: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: () => {
                  return Object.assign({}, state, { thirdAction: true })
                }
              })
            }
            case FOURTH_SIDE_EFFECT_MSG: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: () => {
                  return Object.assign({}, state, { fourthAction: true })
                }
              })
            }
            default:
              return state
          }
        }

        const firstSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return [
              testEffects.queuedDelayedValue(
                10,
                'something',
                FIRST_SIDE_EFFECT_MSG
              ),
              testEffects.queuedDelayedValue(
                5,
                'something',
                SECOND_SIDE_EFFECT_MSG
              )
            ]
          }
        }

        const secondSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return [
              testEffects.queuedDelayedValue(
                20,
                'something',
                THIRD_SIDE_EFFECT_MSG
              ),
              testEffects.queuedDelayedValue(
                15,
                'something',
                FOURTH_SIDE_EFFECT_MSG
              )
            ]
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(firstSubscriber)
        subscribe(secondSubscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        const subscriberPromise = store.dispatch({
          type: SET_COUNTER,
          value: 1
        })

        return subscriberPromise.then(() => {
          expect(
            store.getState().firstAction && store.getState().secondAction
          ).toBe(true)
          expect(
            store.getState().thirdAction && store.getState().fourthAction
          ).toBe(true)
        })
      })

      test('only after all related/subsequent effects are resolved', function() {
        expect.assertions(1)

        const FLOW_COMPLETE_MSG = 'FLOW_COMPLETE_MSG'
        const initialState = {
          counter: 0,
          undo: [],
          done: false
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case ADD_UNDO: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: undo => {
                  return Object.assign({}, state, {
                    undo: state.undo.concat(undo)
                  })
                }
              })
            }
            case FLOW_COMPLETE_MSG: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: undo => {
                  return Object.assign({}, state, {
                    done: true
                  })
                }
              })
            }
            default:
              return state
          }
        }

        const firstSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.queuedDelayedValue(20, from.counter, ADD_UNDO)
          }
        }

        const secondSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.undo)) {
            return testEffects.queuedDelayedValue(
              20,
              'something',
              FLOW_COMPLETE_MSG
            )
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(firstSubscriber)
        subscribe(secondSubscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store
          .dispatch({
            type: SET_COUNTER,
            value: 1
          })
          .then(() => {
            expect(store.getState()).toMatchObject({
              counter: 1,
              undo: [0],
              done: true
            })
          })
      })

      test('even when an immediate effect returns a rejected promise', function() {
        expect.assertions(1)

        const errorText = 'hardcoded exception'
        const initialState = {
          counter: 0,
          undo: [],
          foo: undefined
        }
        const reducer = (state = initialState, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case ADD_UNDO: {
              return Object.assign({}, state, {
                undo: state.undo.concat(action.undo)
              })
            }
            case EFFECT_ENDED_MSG: {
              return matchAction(action, {
                Error: () => {
                  return state
                },
                Ok: value => {
                  throw new Error('effect was expected to fail')
                }
              })
            }
            default:
              return state
          }
        }

        const subscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.immediateReject(errorText, EFFECT_ENDED_MSG)
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(subscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store
          .dispatch({
            type: SET_COUNTER,
            value: 1
          })
          .then(value => expect(value).toBeUndefined())
      })
    })

    describe('that rejects', function() {
      test('if at least one queued effect rejects', function() {
        expect.assertions(1)

        const initialState = {
          root: {
            counter: 0
          }
        }
        const reducer = (state = initialState['root'], action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            default:
              return state
          }
        }

        const getCounter = state => state.root.counter

        const firstSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(getCounter)) {
            return testEffects.queuedDelayedValue(20, 'something', 'SOME_MSG')
          }
        }

        const errorText = 'hardcoded rejection'
        const secondSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(getCounter)) {
            return testEffects.queuedDelayedReject(20, errorText, 'ANOTHER_MSG')
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(firstSubscriber)
        subscribe(secondSubscriber)
        const store = createStore(
          combineReducers({ root: reducer }),
          initialState,
          applyMiddleware(middleware)
        )

        return store
          .dispatch({
            type: SET_COUNTER,
            value: 1
          })
          .catch(e => {
            expect(e.message).toEqual(errorText)
          })
      })

      test('if a subsequent effect throws an exception', function() {
        expect.assertions(2)

        const initialState = {
          counter: 0,
          undo: []
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case ADD_UNDO: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: undo => {
                  return Object.assign({}, state, {
                    undo: state.undo.concat(undo)
                  })
                }
              })
            }
            default:
              return state
          }
        }

        const firstSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.queuedDelayedValue(20, from.counter, ADD_UNDO)
          }
        }

        const errorText = 'hardcoded exception'
        const secondSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.undo)) {
            return testEffects.immediateThrow(errorText, 'SOME_MSG')
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(firstSubscriber)
        subscribe(secondSubscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store
          .dispatch({
            type: SET_COUNTER,
            value: 1
          })
          .catch(e => {
            expect(e.message).toEqual(errorText)
            expect(store.getState()).toEqual({
              counter: 1,
              undo: [0]
            })
          })
      })

      test('if a subsequent effect rejects', function() {
        expect.assertions(2)

        const initialState = {
          counter: 0,
          undo: []
        }
        const reducer = (state, action) => {
          switch (action.type) {
            case SET_COUNTER: {
              return Object.assign({}, state, { counter: action.value })
            }
            case ADD_UNDO: {
              return matchAction(action, {
                Error: error => {
                  throw new Error(`unexpected error: ${error}`)
                },
                Ok: undo => {
                  return Object.assign({}, state, {
                    undo: state.undo.concat(undo)
                  })
                }
              })
            }
            default:
              return state
          }
        }

        const firstSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.counter)) {
            return testEffects.queuedDelayedValue(20, from.counter, ADD_UNDO)
          }
        }

        const errorText = 'hardcoded rejection'
        const secondSubscriber = ({ from, to, hasChanged }) => {
          if (hasChanged(state => state.undo)) {
            return testEffects.queuedDelayedReject(20, errorText, 'SOME_MSG')
          }
        }

        const { middleware, subscribe } = createMiddleware()
        subscribe(firstSubscriber)
        subscribe(secondSubscriber)
        const store = createStore(
          reducer,
          initialState,
          applyMiddleware(middleware)
        )

        return store
          .dispatch({
            type: SET_COUNTER,
            value: 1
          })
          .catch(e => {
            expect(e.message).toEqual(errorText)
            expect(store.getState()).toEqual({
              counter: 1,
              undo: [0]
            })
          })
      })
    })
  })
})

describe('onIdle', function() {
  function setupConsecutiveQueuedTriggeredEffectsWithIdleFunc() {
    const initialState = {
      counter: 0,
      undo: []
    }
    const reducer = (state, action) => {
      switch (action.type) {
        case SET_COUNTER: {
          return Object.assign({}, state, { counter: action.value })
        }
        case ADD_UNDO: {
          return matchAction(action, {
            Error: error => {
              throw new Error(`unexpected error: ${error}`)
            },
            Ok: undo => {
              return Object.assign({}, state, {
                undo: state.undo.concat(undo)
              })
            }
          })
        }
        default:
          return state
      }
    }

    let firstTrigger = null
    let secondTrigger = null
    const firstSubscriber = ({ from, to, hasChanged }) => {
      if (hasChanged(state => state.counter)) {
        const immediateEffect = testEffects.immediateValue(
          from.counter,
          ADD_UNDO
        )
        const queuedEffect = testEffects.queuedTriggeredValue(0, 'BOGUS_ACTION')
        firstTrigger = queuedEffect.trigger
        return [immediateEffect, queuedEffect]
      }
    }

    const secondSubscriber = ({ from, to, hasChanged }) => {
      if (hasChanged(state => state.undo)) {
        const effect = testEffects.queuedTriggeredValue(from.undo, 'SOME_MSG')
        secondTrigger = effect.trigger
        return effect
      }
    }

    const { middleware, subscribe, onIdle } = createMiddleware()
    subscribe(firstSubscriber)
    subscribe(secondSubscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    const idleFunc = jest.fn()
    const unregisterIdleCallback = onIdle(idleFunc)

    store.dispatch({
      type: SET_COUNTER,
      value: 1
    })

    return {
      firstTrigger,
      secondTrigger,
      idleFunc,
      unregisterIdleCallback
    }
  }

  test('should not call a registered idle callback before any queued effect has executed', async function() {
    const { idleFunc } = setupConsecutiveQueuedTriggeredEffectsWithIdleFunc()
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          expect(idleFunc).toHaveBeenCalledTimes(0)
          resolve()
        } catch (e) {
          reject(e)
        }
      }, 0)
    })
  })

  test('should not call a registered idle callback when there are still side-effects left to execute', async function() {
    const {
      firstTrigger,
      idleFunc
    } = setupConsecutiveQueuedTriggeredEffectsWithIdleFunc()

    firstTrigger()
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          expect(idleFunc).toHaveBeenCalledTimes(0)
          resolve()
        } catch (e) {
          reject(e)
        }
      }, 0)
    })
  })

  test('should call a registered idle callback when there are no side-effects left to execute', async function() {
    const {
      firstTrigger,
      secondTrigger,
      idleFunc
    } = setupConsecutiveQueuedTriggeredEffectsWithIdleFunc()

    firstTrigger()
    secondTrigger()

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          expect(idleFunc).toHaveBeenCalledTimes(1)
          resolve()
        } catch (e) {
          reject(e)
        }
      }, 0)
    })
  })

  test('should not call an unregistered idle callback when there are no side-effects left to execute', async function() {
    const {
      firstTrigger,
      secondTrigger,
      idleFunc,
      unregisterIdleCallback
    } = setupConsecutiveQueuedTriggeredEffectsWithIdleFunc()

    firstTrigger()
    unregisterIdleCallback()

    secondTrigger()

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          expect(idleFunc).toHaveBeenCalledTimes(0)
          resolve()
        } catch (e) {
          reject(e)
        }
      }, 0)
    })
  })
})
