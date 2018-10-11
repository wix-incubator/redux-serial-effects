'use strict'

const sink = () => {}

const _match = (either, patterns) => {
  return either.fold(patterns.Error || sink, patterns.Ok || sink)
}

const left = value => ({
  map(fn) {
    return this
  },
  fold(f, g) {
    return f(value)
  },
  chain(fn) {
    return this
  },
  match(patterns) {
    return _match(this, patterns)
  },
  value
})

const right = value => ({
  map(fn) {
    return right(fn(value))
  },
  fold(f, g) {
    return g(value)
  },
  chain(fn) {
    return fn(value)
  },
  match(patterns) {
    return _match(this, patterns)
  },
  value
})

const sequence = eitherList => {
  return eitherList.reduce(
    (acc, either) => acc.chain(list => either.map(value => list.concat(value))),
    right([])
  )
}

const try_ = fn => {
  try {
    return right(fn())
  } catch (e) {
    return left(e)
  }
}

const Either = {
  Left: left,
  Right: right
}

module.exports = {
  Either,
  sequence,
  try_
}
