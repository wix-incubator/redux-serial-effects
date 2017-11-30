'use strict'

const flatten = array => array.reduce((acc, val) => acc.concat(val), [])

module.exports.flatten = flatten
