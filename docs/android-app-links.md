# Android website association

The production Android app is `com.aarvasa.app`. The public statement in
`public/.well-known/assetlinks.json` was copied from Play Console's **App signing
→ Digital Asset Links JSON** on 9 November 2026. It uses the Play app signing
certificate, not the upload certificate. No private key is needed or stored.

The installed version 8 manifest declares `www.aarvasa.com` and supported exact
paths. It already enables automatic domain verification. Before this fix, the
www association endpoint returned HTML with HTTP 404. The apex redirected to
www. Those responses cannot verify an Android website association.

## Production delivery

`www.aarvasa.com` resolves to CloudFront distribution `E24SVODTC5QTQE`
(`d2th8egkj8inzs.cloudfront.net`), in front of the ECS website. The Amplify
application still exists, but an Amplify build alone does not update this
production origin.

The existing viewer-request CloudFront function
`us-east-1AarvasaAppRuntimeProdApexRedirectC40A4DAF` now serves the exact
`/.well-known/assetlinks.json` path directly for GET and HEAD on
`www.aarvasa.com`. It also supports `aarvasa.com` if routed through this
distribution, before the normal apex redirect. Its source
is `infra/cloudfront/apex-redirect-and-app-links.js`. Other requests retain the
previous pass-through or canonical redirect behavior. The JSON response has
HTTP 200, `Content-Type: application/json`, and a five-minute cache lifetime.

Keep the edge statement and public file identical. Include this function source
when next reconciling the runtime CDK stack; do not replace the deployed function
with the previous redirect-only source. The public file also accompanies future
website builds, including the existing Dockerfile's public-directory copy.

Before publishing an update, run:

```sh
node --test --experimental-strip-types test/android-app-links.test.ts
```

Read the existing CloudFront function and its ETag, update DEVELOPMENT with the
tracked source, and use `aws cloudfront test-function` to check both association
hosts, an ordinary www request, and an apex redirect. Publish only after all four
checks succeed. Preserve the prior function source and configuration for rollback.

## Verification

The host declared in the app must return JSON with HTTP 200 and no redirect:

- https://www.aarvasa.com/.well-known/assetlinks.json

The apex currently points to a separate Amplify-managed distribution
(`d3dpfq9gj4ncrn.cloudfront.net`) and still redirects to www. It is not declared
in the version 8 Android manifest. No apex DNS or hosting changes were needed.
If a future app version declares the apex, publish a direct association there
before releasing that version.

Check Google's Digital Asset Links API for relation
`delegate_permission/common.handle_all_urls`, package `com.aarvasa.app`, and
the certificate in the public file. The response should report `linked: true`.

Production checks on 9 November 2026: CloudFront function status `DEPLOYED`;
the www endpoint returned direct HTTP 200 with the exact Play statement; Google's
Digital Asset Links API returned `linked: true`. All three local regression
tests and all four CloudFront DEVELOPMENT test events passed before publication.

Finally, on an Android 12+ device with the Play-installed app:

```sh
adb shell pm set-app-links --package com.aarvasa.app 0 all
adb shell pm verify-app-links --re-verify com.aarvasa.app
# Allow a few minutes for asynchronous verification.
adb shell pm get-app-links com.aarvasa.app
adb shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d https://www.aarvasa.com/listings
```

Expect `www.aarvasa.com: verified` and the listings screen. Repeat with a project
URL, with the app closed and already running. Website/API verification is not a
substitute for this device routing test. Play Console and existing devices can
take time to refresh their previous verification result.
