# Browser frame-time repair

The existing GSAP/ScrollTrigger owner and all sixteen named opening variants are retained. No new ScrollTrigger or autonomous shader clock was added.

The material renderer can now run in one module worker. It receives the same opening/card/depth clocks and the surface normals; WebGL draws, bitmap cropping and transfer preparation run outside the HTML/scroll thread. The main thread only presents completed images. One job is in flight, cancelled generations cannot replace newer frames, pending images are closed, and the worker is terminated on cleanup. Unsupported workers or OffscreenCanvas fall back to the existing single-atlas renderer; this is tested rather than inferred from a browser name.

Only animated 3D ancestors are sampled for normals each frame; static/2D ancestors are cached. The mobile material atlas is bounded to 360,000 pixels, down from 800,000; the desktop bound is 1,400,000. This affects translucent material only; photographs and HTML text retain their resolution. The budget stays stable during a gesture. Old material remains visible until a replacement bitmap is ready after rotation.

While an opaque opening covers the page, hidden ambient card and background tracks retain their logical scroll time without repeatedly seeking invisible layers. They catch up to the exact clock at the existing fade. Forward/reverse gestures and held intermediate positions remain scroll-driven. Compositing hints are scoped to the existing opening surfaces and reveal blocks; the parallax length property no longer inherits through their descendants.

Local browser evidence and limitations are recorded in `.design/reports/browser-frame-verification.md`. GitHub Actions repeats the same engine checks in Chromium, WebKit and Firefox on Linux using fictional records. The suite uses no real customer order changes or outgoing messages.
