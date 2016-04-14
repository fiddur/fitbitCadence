'use latest'
'use strict'

const express     = require('express')
const webtask     = require('webtask-tools')
const bodyParser  = require('body-parser')
const rp          = require('request-promise')
const MongoClient = require('mongodb').MongoClient
const Promise     = require('bluebird')

const app = express()
app.use(bodyParser.json())

const UserStore = userCollection => ({
  get: id => userCollection.findOne({fitbitId: id}),
  update: (id, update, options) => userCollection.findOneAndUpdate(
    {fitbitId: id},
    {$set: update},
    options
  ),
})

/// todo break out fitbit api-client so we don't have to pass id and secret.
const getStepsFromFitbit = (rp, db, userStore, user, date, clientID, clientSecret) => {
  const stepsUrl = 'https://api.fitbit.com/1/user/' + user.fitbitId +
        '/activities/steps/date/' + date + '/1d/1min.json'
  return rp({
    headers: {'Authorization': 'Bearer ' + user.accessToken},
    uri:     stepsUrl,
    json:    true,
  }).catch(err => {
    // Try to use refreshToken to get new accessToken.
    if (err.statusCode === 401 && err.error.errors[0].errorType === 'expired_token') {
      return getNewFitbitAccessToken(rp, userStore, user, clientID, clientSecret)
        .then(accessToken => {
          user.accessToken = accessToken // @todo Update in Mongo
          return getStepsFromFitbit(rp, db, userStore, user, date, clientID, clientSecret)
        })
    }
    else throw err
  })
}

// Store all steps in separate collection for later charting.
const updateStepsInMongo = (db, id, date, steps) => {
  return db.collection('steps').findOneAndUpdate(
    {user: id, date: date},
    {user: id, date: date, steps: steps},
    {upsert: true}
  )
}

const getNewFitbitAccessToken = (rp, userStore, user, clientID, clientSecret) => {
  const basic = new Buffer(clientID + ':' + clientSecret).toString('base64')
  console.log('Refreshing with refreshToken:', user.refreshToken)
  return rp({
    method: 'POST',
    uri: 'https://api.fitbit.com/oauth2/token',
    headers: {
      'Authorization': 'Basic ' + basic,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
    },
  }).then(response => {
    // Update accessToken in db.
    userStore.update(
      user.fitbitId,
      {
        accessToken:  response.access_token,
        refreshToken: response.refresh_token,
      }
    ).catch(err => console.log(err)) // This error is not fatal for the token.

    return response.access_token
  }).catch(err => {
    console.log('Couldnt refresh token.  Clearing tokens from user', user.fitbitId)
    console.log(err2.name, err2.statusCode, err2.message, err2.error)

    //// If we can't refresh the accessToken, remove all tokens from user.
    //return userStore.update(
    //  user.fitbitId,
    //  {accessToken: null, refreshToken: null}
    //)
  })
}

/// Find runs; reduce steps to an array of runs with start, pauses, and end
const analyzeSteps = steps => {
  const runs = []
  let current = null

  steps.forEach((step, i, steps) => {
    const times = step.time.split(':')
    const minute = parseInt(times[0]) * 60 + parseInt(times[1]) // Minute of day.

    if (step.value > 120) {
      // Running this minute.
      if (!current) current = {start: minute, pauses: [], steps: [step.value]}
      else if ('end' in current) {
        if (minute - current.end < 15) {
          // Consider not running for < 15 minutes a pause.
          current.pauses.push({start: current.end, end: minute - 1})
          delete current.end
        }
        else {
          // New run!
          runs.push(current)
          current = {start: minute, pauses: [], steps: [step.value]}
        }
      }
      else current.steps.push(step.value)
    }
    else if (current && !('end' in current)) {
      current.end = minute - 1
      if (current.end - current.start < 3) current = null
    }
  })
  if (current) runs.push(current)

  // Add median cadence to all runs.
  runs.forEach(run => {
    const sortedSteps = run.steps.slice().sort()
    const lowMiddle = Math.floor(sortedSteps.length / 2)
    run.median = (sortedSteps.length % 2)
      ? sortedSteps[lowMiddle]
      : (sortedSteps[lowMiddle] + sortedSteps[lowMiddle + 1]) / 2
  })

  return runs
}

app.post('/', (req, res) => {
  res.sendStatus(204) // Just acknowledge receiving the push.

  app.locals.mongo.connect(req.webtaskContext.secrets.MONGO_URL, {promiseLibrary: Promise})
    .then(db => {
      const userStore = UserStore(db.collection('users'))

      return Promise.all(req.body.map(
        updated => userStore.get(updated.ownerId)
          .then(user => Promise.all([
            user,
            getStepsFromFitbit(
              app.locals.rp, db, userStore, user, updated.date,
              req.webtaskContext.secrets.FITBIT_CLIENT_ID,
              req.webtaskContext.secrets.FITBIT_CLIENT_SECRET
            )
          ]))
          .spread((user, steps) => Promise.all([
            updateStepsInMongo(
              db, updated.ownerId, updated.date,
              steps['activities-steps-intraday'].dataset
            ),
            analyzeSteps(steps['activities-steps-intraday'].dataset),
            user
          ]))
          .spread((result, analysis, user) => userStore.update(
            user.fitbitId, {['runsByDate.' + updated.date]: analysis}
          ))
      ))
    })
    .then(result => {console.log('All things done.', result)})
    .catch(err => {console.log('Err', err)})
})

// For Fitbit verify-calls.
app.get('/', (req, res) => {
  if (req.query.verify === req.webtaskContext.secrets.FITBIT_VERIFY) return res.sendStatus(204)
  res.sendStatus(404)
})

module.exports = (context, req, res) => {
  // Allow io-handlers to be overridden for testing.
  app.locals.mongo = context.mongoClient || MongoClient
  app.locals.rp    = context.rp          || rp

  return webtask.fromExpress(app)(context, req, res)
}
module.exports.UserStore = UserStore
