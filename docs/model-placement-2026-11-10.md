# Model placement correction — 10 November 2026

REEF 997 was positioned at a third-party locality coordinate (25.28990, 55.30238) and all map models used heading 0. The developer project page now supplies the map pin (25.290036491479, 55.302410776762): approximately 15.5 m north and 3.1 m east of the previous point.

The developer floor-plan PDF, page 3, shows north approximately 33 degrees clockwise from page-up. Page 6 matches the model source aerial on page 13 of the full brochure: tower on the upper/right sides, pool at lower left, driveway at left. Therefore model drawing-up bears approximately 327 degrees. Use heading 327 while retaining the existing tilt 270 axis conversion, scale 10 and measured 22.65 m base offset. Do not substitute camera heading for model heading.

The footprint remains the approved visual reconstruction (~39 x 38 m, estimated +/-15%); this is not a surveyed building model or boundary. No surveyed corner coordinates were found. Public text must keep the approximate footprint/alignment qualification.

The viewer now keeps coordinate identity stable and removes its own model on cleanup, preventing stacked models when controls cause a rerender or the overlay is toggled.

## Evidence

- REEF 996: [https://reefdevelopments.ae/projects/reef-996](https://reefdevelopments.ae/projects/reef-996), embedded map props `25.0375278, 55.20175`, retrieved 10 November 2026. HTML SHA-256 `5b0b7e3bc8a11d1fde3cefd6d9da92e2246af9f49db65f1619f25857ca90b244`.
- REEF 997: [https://reefdevelopments.ae/projects/reef-997](https://reefdevelopments.ae/projects/reef-997), embedded map props `25.290036491479, 55.302410776762`, retrieved 10 November 2026. HTML SHA-256 `2d431cd54152de7d6c2b5ddb4fe2fc6e838a039150f1023ab30bcea02f7df075`.
- REEF 998: [https://reefdevelopments.ae/projects/reef-998](https://reefdevelopments.ae/projects/reef-998), embedded map props `25.1000478, 55.3746666`, retrieved 10 November 2026. HTML SHA-256 `022d2445e8429edfd4c9b2656ef9643fac92da45ac5ec75d7531d3df47b3b211`.
- REEF 999: [https://reefdevelopments.ae/projects/reef-999](https://reefdevelopments.ae/projects/reef-999), embedded map props `25.0180659, 55.1333461`, retrieved 10 November 2026. HTML SHA-256 `ce294a42272a14019ec0b49a36aab6b2679cc21882b94dc4bc9ec5f9f43fe541`.
- REEF 1000: [https://reefdevelopments.ae/projects/reef-1000](https://reefdevelopments.ae/projects/reef-1000), embedded map props `25.0862283, 55.3800196`, retrieved 10 November 2026. HTML SHA-256 `13dadf8442c96ba036867fd1bd999749cfeba55609897d8894f52e2b5ff1cb85`.

Floor-plan source: https://reelly-backend.s3.amazonaws.com/project_files/f10451363f7149a99a23f6fb01a01fc5.pdf (local research/brochures/reef-997.pdf). Page 3 north arrow and page 6 amenity plan. SHA-256 `9ea016dd9c919e467b25f79240a3c47e9fda479af0a4a186617d7813157c7289`.

Developer project-page pins replace third-party locality positions for 996, 997 and 998; 999 and 1000 already match. Precision is developer-pin, not surveyed plot. Bearings for the other projects remain unchanged; no orientation is invented.
