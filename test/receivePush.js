'use strict'

const assert    = require('assert')
const aasync    = require('asyncawait/async')
const aawait    = require('asyncawait/await')
const httpMocks = require('node-mocks-http')
const events    = require('events')

const receivePush = require('../webtasks/receivePush.js')

describe('receivePush handler', () => {
  describe('Fitbit verification', () => {
    it('should give 204 on correct token', (done) => {
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

    it('should give 404 on wrong token', (done) => {
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
})
