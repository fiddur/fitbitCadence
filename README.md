Fitbit cadence
==============

A little play project to use webtasks and github pages to analyze my step cadence from Fitbit API.

Deployment:
```
wt init

MONGO_URL=mongodb://get:your@own.mlab.com:15740/fitbit-running-cadence \
FITBIT_CLIENT_ID=GET \
FITBIT_CLIENT_SECRET=YOUROWN \
JWT_SERCRET=secret \
FITBIT_VERIFY=subscriptionverificationstring \
make
```
