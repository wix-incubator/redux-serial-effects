// @flow
'use strict'

const flatten = <T>(array: Array<T[] | T>): Array<T> =>
  array.reduce((acc, val) => acc.concat(val), [])

module.exports.flatten = flatten
