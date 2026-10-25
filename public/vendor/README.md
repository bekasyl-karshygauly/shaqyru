qrcode.mjs is the unmodified ES module from qrcode-generator 2.0.4,
Copyright (c) 2009 Kazuhiko Arase, distributed under the MIT license.
Source: https://github.com/kazuhikoarase/qrcode-generator
The package is pinned in package-lock.json. QR generation runs locally;
invitation links are not sent to an external QR service.
# GSAP / ScrollTrigger

`gsap.min.js` and `ScrollTrigger.min.js` are the unmodified distribution files from
the pinned npm dependency `gsap@3.15.0`. They are served locally to keep invitation
motion independent of third-party CDNs. Retain their embedded copyright/license
headers. License: https://gsap.com/standard-license/ (GreenSock standard license).
To update, change the pinned dependency and copy these two `dist/` files together.

# Three.js

`three.module.min.js` bundles the invitation renderer's named exports from pinned
`three@0.186.1` (MIT, see `three-LICENSE.txt`). `npm run assets:three` rebuilds it
with pinned esbuild. Only the local module is loaded, lazily when motion and
WebGL2 are available; no CDN or remote texture service is needed. Photos and
guest text stay in their existing HTML layers.

