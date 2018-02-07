'use strict'

const { createStore, applyMiddleware } = require('redux')
const {
  createMiddleware,
  matchAction,
  createQueuedCmd
} = require('../src/index')

// actions
const SET_DISPLAY_ITEM = 'SET_DISPLAY_ITEM'
const DATA_RESPONSE = 'DATA_RESPONSE'

// commands
const GET_DATA_BY_ID = 'GET_DATA_BY_ID'

const EXECUTOR_TYPE = 'DATA_SERVICE_CLIENT'

const remoteDataServiceClient = {
  type: EXECUTOR_TYPE,
  execute: cmd => {
    switch (cmd.type) {
      case GET_DATA_BY_ID: {
        // async network operation
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve({ content: 'item data' }), 10)
        })
      }
    }
  }
}

const getDataFromRemoteServiceCmd = (id, actionType) =>
  createQueuedCmd(
    EXECUTOR_TYPE,
    {
      type: GET_DATA_BY_ID,
      id
    },
    actionType
  )

const setItemToDisplay = id => ({
  type: SET_DISPLAY_ITEM,
  id
})

const initialState = {
  itemToDisplay: {
    id: 0,
    data: {}
  },
  errorState: false,
  errorDescription: null
}

test('reference implementation', function() {
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_DISPLAY_ITEM: {
        return Object.assign({}, state, {
          itemToDisplay: Object.assign({}, state.itemToDisplay, {
            id: action.id
          })
        })
      }
      case DATA_RESPONSE: {
        return matchAction(action, {
          Error: error => {
            return Object.assign({}, state, {
              errorState: true,
              errorDescription: error
            })
          },
          Ok: data => {
            return Object.assign({}, state, {
              errorState: false,
              errorDescription: null,
              itemToDisplay: Object.assign({}, state.itemToDisplay, { data })
            })
          }
        })
      }
      default:
        return state
    }
  }

  const getDisplayItemId = state => state.itemToDisplay.id

  const subscriber = ({ from, to, hasChanged }) => {
    if (hasChanged(getDisplayItemId)) {
      return getDataFromRemoteServiceCmd(to.itemToDisplay.id, DATA_RESPONSE)
    }
  }

  const { middleware, subscribe, registerExecutors } = createMiddleware()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerExecutors(remoteDataServiceClient)

  return store.dispatch(setItemToDisplay(1)).then(() => {
    expect(store.getState()).toEqual({
      errorDescription: null,
      errorState: false,
      itemToDisplay: { data: { content: 'item data' }, id: 1 }
    })
  })
})
