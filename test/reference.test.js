'use strict'

const { createStore, applyMiddleware } = require('redux')
const { createMiddleware, matchAction } = require('../src/index')

// actions

const SET_DISPLAY_ITEM = 'SET_DISPLAY_ITEM'
const DATA_RESPONSE = 'DATA_RESPONSE'

const setItemToDisplay = id => ({
  type: SET_DISPLAY_ITEM,
  id
})

// effects

const getDataFromRemoteServiceEffect = id => ({
  run: () =>
    new Promise((resolve, reject) => {
      setTimeout(() => resolve({ content: 'item data' }), 10)
    }),
  isQueued: true,
  resultActionType: DATA_RESPONSE
})

// state

const initialState = {
  itemToDisplay: {
    id: 0,
    data: {}
  },
  errorState: false,
  errorDescription: null
}

const getDisplayItemId = state => state.itemToDisplay.id

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

const subscriber = ({ from, to, hasChanged }) => {
  if (hasChanged(getDisplayItemId)) {
    return getDataFromRemoteServiceEffect(to.itemToDisplay.id)
  }
}

test('reference implementation', function() {
  const { middleware, subscribe } = createMiddleware()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store.dispatch(setItemToDisplay(1)).then(() => {
    expect(store.getState()).toEqual({
      errorDescription: null,
      errorState: false,
      itemToDisplay: { data: { content: 'item data' }, id: 1 }
    })
  })
})
