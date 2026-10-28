# Price/design confirmation recovery

The live read-only order check showed a current 8,990 ₸ quote with no recorded customer acceptance. No real acceptance, publication or price change was performed by the agent.

The old quote button wrote errors into the far bottom of the long order dialog and did not label pending confirmation. A reproducible failure also existed after an unsuccessful first status load: a later order refresh displayed the quote but never restored cloudReady, so saveSrv continued to reject every confirmation attempt. Recovery now follows the initial load's clean-draft/version-conflict rules and ignores a late first-load response after successful recovery.

The quote section now owns its pending/success/error feedback and GET-only recovery action. Double clicks are blocked. Success requires a matching server quote and current approval; malformed responses never announce agreement. Changed conditions clear the checkbox. Dirty conflicting drafts lead to the existing recovery banner after the modal closes, with correct focus and without automatically replacing data. After actual confirmation the checkbox remains checked and the button is disabled with an explicit success label.

Editor requests and the startup guest-details readiness request use AbortController timers, so a missing AbortSignal.timeout does not leave the editor inert or prevent agreement. No animation code or server permission/pricing guard was removed.

Tests are recorded in `.design/reports/quote-confirmation-verification.md`. They use fictional records and intercepted APIs; live customer agreements, messages and invitations are untouched.
