'use strict'

const { flatten } = require('./utils/flatten')

const combineSubscribers = subscriberMap => (transition, extraArgument) =>
  flatten(
    Object.keys(subscriberMap).map(
      key =>
        transition.from[key] !== transition.to[key] && subscriberMap[key]
          ? flatten(
              [].concat(
                subscriberMap[key](
                  {
                    from: transition.from[key],
                    to: transition.to[key]
                  },
                  extraArgument
                )
              )
            )
          : []
    )
  )

module.exports = combineSubscribers
