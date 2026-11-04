# Cookie and Session Policy (draft for review)

The API issues `gha_access` as an HttpOnly, SameSite=Lax cookie; it is marked Secure when `APP_ENV=production`. `gha_csrf` is readable by frontend JavaScript and is paired with an `X-CSRF-Token` header on state-changing authenticated requests. Access tokens currently expire after the configured duration (30 minutes by default); there is no refresh token. Signing out clears browser cookies. A password reset increments the user's session version, invalidating previously issued access tokens.

The frontend also saves the theme and interface-language preference in browser local storage. It does not use an analytics or advertising cookie. Cross-site deployment may prevent the Lax session cookie from working; deploy frontend/API on the same site and configure exact CORS origins. Production proxy/TLS settings and cookie behavior must be verified on the chosen host.

**Approval:** not approved. Confirm applicable notice/consent requirements, session duration, shared-device guidance and security controls with counsel and the privacy owner.
