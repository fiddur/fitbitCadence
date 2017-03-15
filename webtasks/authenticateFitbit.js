'use latest'
'use strict'

const express     = require('express')
const webtask     = require('webtask-tools')
const MongoClient = require('mongodb').MongoClient
const rp          = require('request-promise')
const jwt         = require('jsonwebtoken')
const Promise     = require('bluebird')
const moment      = require('moment')

const app = express()

// When user has requested authentication, this would be opened in a new window.
// User gets redirected to Fitbit for OAuth2 authentication.
app.get('/', (req, res, next) => {
  if ('state' in req.query) return next() // Go to callback handler below.

  res.redirect(
    `${'https://www.fitbit.com/oauth2/authorize?' +
      'scope=activity%20heartrate%20location%20profile%20weight&' +
      'state=fitbitCallback&' +
      'response_type=code&' +
      'redirect_uri='}${encodeURIComponent('https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/authenticateFitbit/')}&` +
      `client_id=${req.webtaskContext.secrets.FITBIT_CLIENT_ID}`,
  )
})

// Fitbit callback (with state in query); user is redirected here after having authenticated.
app.get('/', (req, res, next) => {
  if (!('state' in req.query)) return next()

  const clientID     = req.webtaskContext.secrets.FITBIT_CLIENT_ID
  const clientSecret = req.webtaskContext.secrets.FITBIT_CLIENT_SECRET
  const basic        = new Buffer(`${clientID}:${clientSecret}`).toString('base64')

  Promise.resolve()
    // Authentication OAuth2: get access token and user id.
    .then(() => rp({
      method:  'POST',
      uri:     'https://api.fitbit.com/oauth2/token',
      headers: {
        Authorization:  `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      form: {
        code:         req.query.code,
        grant_type:   'authorization_code',
        client_id:    clientID,
        redirect_uri: 'https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/authenticateFitbit/',
        state:        'fitbitCallback',
      },
      json: true,
    }))

    // Connect to database.
    .then(body => {
      console.log(`Updating tokens from fitbit for user ${body.user_id}`)
      return [body, MongoClient.connect(req.webtaskContext.secrets.MONGO_URL)]
    })

    // Update user with new tokens.
    .spread((body, db) => [
      db,
      db.collection('users').findOneAndUpdate(
        { fitbitId: body.user_id },
        { $set: {
          lastLogin:    moment().format(),
          accessToken:  body.access_token,
          refreshToken: body.refresh_token,
        } },
        { upsert: true, returnNewDocument: true },
      ),
    ])

    // Make sure user is subscribed (async fire&forget) and return a userJwt.
    .spread((db, result) => {
      const user = result.value

      if (!user.isSubscribed) {
        console.log(`Adding activity subscription for ${user.fitbitId}`)
        Promise.resolve() // trying out other chain formatting…
          // Add activity subscription.
          .then(() => rp({
            headers: { Authorization: `Bearer ${user.accessToken}` },
            method:  'POST',
            uri:     `https://api.fitbit.com/1/user/${user.fitbitId
               }/activities/apiSubscriptions/${
               user.fitbitId}.json`,
          }))

          // Note on user that it is subscribed.
          .then(response => db.collection('users').findOneAndUpdate(
            { fitbitId: user.fitbitId },
            { $set: { isSubscribed: true } },
          ))
          .catch(err => console.log(err)) // Not vital to authentication.
      }

      // Construct a signed JWT with fitbitId.
      const userJwt = jwt.sign(
        { sub: result.value.fitbitId },
        req.webtaskContext.secrets.JWT_SECRET,
        { expiresIn: '2 days' },
      )

      // This would be loaded in a child window.  Notify the opener about user and close.
      res.send(
        `${'<html><head></head><body><script>\n' +
          'window.opener.postMessage("'}${userJwt}", "*")\n` +
          'window.close()\n' +
          '</script></body></html>',
      )
    })
    .catch(err => {
      console.log(err)
      res.status(500).send('Didn\'t work :·(')
    })
})

module.exports = webtask.fromExpress(app)
