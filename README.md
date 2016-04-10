Fitbit cadence
==============

A little play project to use webtasks and github pages to analyze my step cadence from Fitbit API.

Deployment:
```
npm install -g wt-cli
wt init

MONGO_URL=mongodb://get:your@own.mlab.com:15740/fitbit-running-cadence \
FITBIT_CLIENT_ID=GET \
FITBIT_CLIENT_SECRET=YOUROWN \
JWT_SERCRET=secret \
FITBIT_VERIFY=subscriptionverificationstring \
make
```

Webtasks?
---------

[webtask.io](https://webstask.io) is a very convenient way of trying out a simple backend.  It's
made and hosted by Auth0, and they have a free plan for trying out things.

This repo uses 3 webtasks:

### authenticateFitbit

Opened in a new window, handles OAuth2 with redirection to fitbit and the necessary backend calls.

I tried using passport and express, but webtask have a limited number of npm modules, and they
weren't available.  Then I tried using browserify to just pack it all, but the size got
rediculously big!  And that's probably a good thing, because it made me realize that the code I had
to write to actually get access token for fitbit with manual request was even less than using
passport, and it brought no extra dependencies!


### receivePush

This is the subscription endpoint that I put into Fitbit API client settings.

It has to answer to two validation calls, but otherwise it handles push notifications of when a
user has new data.  When that happens, it fetches by minute-step data from that day and analyzes it
to recognize running.  Whenever I take more than 120 steps per minute for at least 3 minutes, it's
considered running.  Then, if I go under that value for up to 15 minutes and resume, it's
consideres a pause.  It also calculates a median cadence, and puts it all into a mongo db.

### cadence

This is the endpoint that my super simple single page app here on github pages uses to get data
about analysed runs.


Fitbit quirks
-------------

The Fitbit API is only semi-open.  I don't have a "Partner API client", but I do have a "Personal
client".  Unfortunately, that means that I only get access to my own intra-day time series, so this
app is only useful to myself right now.  However, anyone should be able to clone it and get their
own personal api client with fitbit.
