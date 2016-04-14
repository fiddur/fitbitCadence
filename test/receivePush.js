'use strict'

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
        query: {verify: 'foo'}
      })
      const res = httpMocks.createResponse({eventEmitter: events})

      receivePush(context, req, res)

      res.on('end', () => {
        console.log(res)
        done()
      })
    })

    it('should give 404 on wrong token', aasync(() => {
    }))
  })
})
