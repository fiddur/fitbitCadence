all: authenticateFitbit receivePush cadence

authenticateFitbit:
	wt create webtasks/authenticateFitbit.js \
	  -s MONGO_URL=$(MONGO_URL) \
	  -s FITBIT_CLIENT_ID=$(FITBIT_CLIENT_ID) \
	  -s FITBIT_CLIENT_SECRET=$(FITBIT_CLIENT_SECRET) \
	  -s JWT_SERCRET=$(JWT_SERCRET) \
	  --no-parse --no-merge

receivePush:
	wt create webtasks/receivePush.js \
	  -s FITBIT_VERIFY=$(FITBIT_VERIFY) \
	  -s MONGO_URL=$(MONGO_URL) \
	  -s FITBIT_CLIENT_ID=$(FITBIT_CLIENT_ID) \
	  -s FITBIT_CLIENT_SECRET=$(FITBIT_CLIENT_SECRET) \
	  --no-parse --no-merge

cadence:
	wt create webtasks/cadence.js \
	  -s MONGO_URL=$(MONGO_URL) \
	  -s JWT_SERCRET=$(JWT_SERCRET)
