// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,

  // Keep account, request, and query data out of telemetry.
  dataCollection: {
    userInfo: false, cookies: false, httpHeaders: false,
    httpBodies: [], urlQueryParams: false, databaseQueryData: false,
    stackFrameVariables: false,
  },
});
