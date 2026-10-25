# Invitation options

- **Compare:** in Design and price, save current styling as A, edit the invitation,
  then compare A with current B. Each preview supports the opening animation.
  Choosing a variant only restores visual fields (including photos and opening),
  keeping text, event details, payment and access fields intact. A is stored in
  IndexedDB separately for each local draft. The two previews stack on small screens.
- **Languages:** expand Two languages for guests under Occasion and language.
  Enable the guest switch and enter Russian/Kazakh overrides for invitation text,
  names, hosts, venue/address, schedule, greeting, dress code, gifts and contact name.
  Empty overrides retain original content, while built-in invitation text and UI
  labels use the chosen language. Custom text is not machine-translated. Existing
  FAQ and photo-story captions remain as authored. The guest switch preserves
  unsent RSVP input for the next navigation. No database migration is required;
  bilingual and translations are stored in the invitation data JSON.
- **QR:** Guests and links contains QR / Print for general and personal links;
  published guest pages also have this action. Download SVG or print/save PDF using
  the browser print dialog. QR contains only the guest URL and optional guest code,
  never an owner token or preview URL. Localhost links are marked as local and need
  a public deployment before guests can open them on other devices.

QR generation uses vendored qrcode-generator 2.0.4 (MIT), without third-party QR
requests. Decoder verification uses jsqr and the existing canvas dependency.
Language additions include compatibility handling for old local edit history.

Verification: 36 unit/server tests and 19 browser tests passed (invitation options,
editor, navigation, and prior upgrades), including decoding the generated QR,
print styles, RSVP preservation, comparison opening animations, and narrow reflow.
Source syntax checks passed. No deployment or real payment was performed.
