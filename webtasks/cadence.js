'use latest'
'use strict'

const MongoClient = require('mongodb').MongoClient
const jwt         = require('jsonwebtoken')

module.exports = (ctx, done) => {
  const userData = jwt.verify(ctx.query.user, ctx.secrets.JWT_SECRET)
  MongoClient.connect(ctx.secrets.MONGO_URL)
    .then(db => db.collection('users').findOne({ fitbitId: userData.sub }))
    .then(user => {
      done(null, { runs: user.runsByDate })
    })
    .catch(err => done(err))
}
