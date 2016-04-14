'use strict'

const assert    = require('assert')
const aasync    = require('asyncawait/async')
const aawait    = require('asyncawait/await')
const httpMocks = require('node-mocks-http')
const events    = require('events')
const Promise   = require('bluebird')

const receivePush = require('../webtasks/receivePush.js')

describe('receivePush handler', () => {
  describe('Fitbit verification', () => {
    it('should give 204 on correct token', done => {
      const context = {secrets: {FITBIT_VERIFY: 'foo'}}
      const req     = httpMocks.createRequest({
        method: 'GET',
        url: '/',
        query: {verify: 'foo'},
        x_wt:  {jtn:    'jtn'},
      })
      const res = httpMocks.createResponse({eventEmitter: events.EventEmitter})

      res.on('end', () => {
        assert.equal(res.statusCode, 204)
        done()
      })

      receivePush(context, req, res)
    })

    it('should give 404 on wrong token', done => {
      const context = {secrets: {FITBIT_VERIFY: 'foo'}}
      const req     = httpMocks.createRequest({
        method: 'GET',
        url: '/',
        query: {verify: 'bar'},
        x_wt:  {jtn:    'jtn'},
      })
      const res = httpMocks.createResponse({eventEmitter: events.EventEmitter})

      res.on('end', () => {
        assert.equal(res.statusCode, 404)
        done()
      })

      receivePush(context, req, res)
    })

  })

  describe('UserStore', () => {
    it('should get a user by id', aasync(() => {
      const userData = {
        '{"fitbitId":"qux"}': {
          fitbitId: 'qux',
          accessToken: 'quuux',
        }
      }

      const collection = {
        findOne: query => Promise.resolve(userData[JSON.stringify(query)])
      }
      const userStore = receivePush.UserStore(collection)

      const user = aawait(userStore.get('qux'))
      assert(user.fitbitId, 'qux')
    }))

    it('should update user by id', aasync(() => {
      const updateCalls = []
      const collection = {
        findOneAndUpdate: (filter, update, options) => {
          updateCalls.push({filter: filter, update: update, options: options})
        }
      }
      const userStore = receivePush.UserStore(collection)

      aawait(userStore.update('foo', {bar: 'baz'}))

      assert.equal(updateCalls.length, 1)
      assert.deepEqual(updateCalls[0].filter, {fitbitId: 'foo'})
      assert.deepEqual(updateCalls[0].update, {$set: {bar: 'baz'}})
    }))
  })

  describe('Receiving a subscription push', () => {
    it('should confirm with status 204 directly no matter what', done => {
      const context = {
        secrets: {MONGO_URL: 'foo'},
        mongoClient: {connect: () => Promise.reject(new Error('No error'))}
      }
      const req     = httpMocks.createRequest({
        method: 'POST',
        url: '/',
        x_wt: {jtn: 'jtn'},
      })
      const res = httpMocks.createResponse({eventEmitter: events.EventEmitter})

      res.on('end', () => {
        assert.equal(res.statusCode, 204)
        done()
      })

      receivePush(context, req, res)
    })
  })
  //
  //  it('should update mongo with steps if accessTokens are up to date', done => {
  //    console.log('Worked?', receivePush.fetchUserFromMongo)
  //
  //    const rpCalls = []
  //
  //    const mongoData = {
  //      users: {
  //        '{"fitbitId":"qux"}': {
  //          fitbitId: 'qux',
  //          accessToken: 'quuux',
  //        }
  //      }
  //    }
  //
  //    const context = {
  //      secrets: {
  //        MONGO_URL:            'foo',
  //        FITBIT_CLIENT_ID:     'bar',
  //        FITBIT_CLIENT_SECRET: 'baz',
  //      },
  //      mongoClient: {connect: () => Promise.resolve({
  //        collection: coll => ({
  //          findOne: query => Promise.resolve(mongoData[coll][JSON.stringify(query)])
  //        })
  //      })},
  //      rp: options => {
  //        rpCalls.push(options)
  //        return Promise.resolve()
  //      }
  //    }
  //    const req = httpMocks.createRequest({
  //      method: 'POST',
  //      url: '/',
  //      x_wt: {jtn: 'jtn'},
  //      body: [{
  //        collectionType: 'activities',
  //        date:           '2016-04-06',
  //        ownerId:        'qux',
  //        ownerType:      'user',
  //        subscriptionId: 'qux'
  //      }]
  //    })
  //    const res = httpMocks.createResponse({eventEmitter: events.EventEmitter})
  //
  //    res.on('end', () => {
  //      assert.equal(res.statusCode, 204)
  //      done()
  //    })
  //
  //    receivePush(context, req, res)
  //
  //
  //  })
  //})
})
