'use strict'

const assert    = require('assert')
const aasync    = require('asyncawait/async')
const aawait    = require('asyncawait/await')
const httpMocks = require('node-mocks-http')
const events    = require('events')
const Promise   = require('bluebird')
const sinon     = require('sinon')

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

  describe('fitbitApi', () => {
    it('should return step data', aasync(() => {
      const rp = sinon.stub()
      rp.onCall(0).returns(Promise.resolve({
        'activities-log-steps': [{dateTime: '1970-01-01',value:1433}],
        'activities-log-steps-intraday': {
          datasetInterval: 1,
          dataset: [
            {time: '00:00:00',value:   0},
            {time: '00:01:00',value:   0},
            {time: '00:02:00',value:   0},
            {time: '00:03:00',value:   0},
            {time: '00:04:00',value:   0},
            {time: '00:05:00',value: 287},
            {time: '00:06:00',value: 287},
            {time: '00:07:00',value: 287},
            {time: '00:08:00',value: 287},
            {time: '00:09:00',value: 287},
            {time: '00:10:00',value:   0},
            {time: '00:11:00',value:   0},
          ]
        }
      }))

      const userStore = {}
      const fitbitApi = receivePush.FitbitApi(rp, 'quux', 'corge', userStore)

      const steps = aawait(fitbitApi.getSteps(
        {fitbitId: 'grault', accessToken: 'garply', refreshToken: 'waldo'}, '1970-01-01'
      ))

      assert(rp.calledOnce)
      const requestArguments = rp.getCall(0).args
      assert(requestArguments[0].uri.match(
        /grault\/activities\/steps\/date\/1970-01-01\/1d\/1min.json/
      ))
    }))

    it('should request a new accessToken on rejection and try again', aasync(() => {
      const rp = sinon.stub()

      const rejectionError = new Error()
      rejectionError.statusCode = 401
      rejectionError.error = {errors: [{errorType: 'expired_token'}]}

      rp.onCall(0).returns(Promise.reject(rejectionError))
      rp.onCall(1).returns(Promise.resolve({
        access_token:  'foo',
        refresh_token: 'bar',
        user_id:       'baz',
      }))
      rp.onCall(2).returns(Promise.resolve('qux'))

      const userStoreUpdate = sinon.spy()
      const userStore = {update: userStoreUpdate}
      const fitbitApi = receivePush.FitbitApi(rp, 'quux', 'corge', userStore)

      const steps = aawait(fitbitApi.getSteps(
        {fitbitId: 'grault', accessToken: 'garply', refreshToken: 'waldo'}, '1970-01-01'
      ))

      assert(
        userStoreUpdate.calledWith('grault', {accessToken: 'foo', refreshToken: 'bar'}),
        'UserStore should be updated with new tokens.'
      )
      const refreshArguments = rp.getCall(1).args
      assert.equal(refreshArguments[0].form.refresh_token, 'waldo')
      assert.equal(steps, 'qux')
    }))
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
