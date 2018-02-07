'use strict'

const { flatten } = require('./utils/flatten')
const createTransition = require('./utils/transition')

const combineSubscribers = subscriberMap => (transition, extraArgument) =>
  flatten(
    Object.keys(subscriberMap).map(
      key =>
        transition.from[key] !== transition.to[key] && subscriberMap[key]
          ? [].concat(
              subscriberMap[key](
                createTransition(transition.from[key], transition.to[key]),
                extraArgument
              )
            )
          : []
    )
  )

module.exports = combineSubscribers
