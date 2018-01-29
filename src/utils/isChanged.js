'use strict'

const isChanged = (from, to) => selector => selector(from) !== selector(to)

module.exports = isChanged
