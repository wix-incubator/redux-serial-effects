'use strict'

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
  value
})

const right = value => ({
  map(fn) {
    return Right(fn(value))
  },
  fold(f, g) {
    return g(value)
  },
  chain(fn) {
    return fn(value)
  },
  value
})

const Left = value => Object.assign(Object.create(null), left(value))
const Right = value => Object.assign(Object.create(null), right(value))

const sequence = eitherList => {
  return eitherList.reduce(
    (acc, either) => acc.chain(list => either.map(value => list.concat(value))),
    Right([])
  )
}

const try_ = fn => {
  try {
    return Right(fn())
  } catch (e) {
    return Left(e)
  }
}

const Either = {
  Left,
  Right
}

module.exports.Either = Either
module.exports.sequence = sequence
module.exports.try_ = try_
