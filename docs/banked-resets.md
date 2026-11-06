# Account banked resets

The Codex quota payload reads `rate_limit_reset_credits` from the existing live
`GET /backend-api/wham/usage` request. Missing/malformed metadata stays unknown;
it is never a synthetic zero. Public reset announcements do not prove an
account has a reset.

The native inventory command reads `GET /backend-api/wham/rate-limit-reset-credits` using the selected
saved profile's OAuth login and ChatGPT workspace header. No account activation
is needed. Eligibility respects `applicable_available_count` when returned,
`is_supported_by_plan`, expiry and the covered main allowances. Unknown plans
or reset types stay visible but cannot be redeemed in Aiturn. Separate model
limits are not included in a full reset's coverage.

The native review step rechecks the inventory and pins the profile identity,
credit, plan, covered windows and expiration to a ten-minute review token.
Confirmation rechecks these details before sending any mutation. Only the
explicit Use 1 reset action calls
`POST /backend-api/wham/rate-limit-reset-credits/consume`.

Before POST, Aiturn atomically saves an owner-only redemption record outside
the repository in its application-data directory. It contains a hashed account
identity, credit metadata and `redeem_request_id`, never credentials. Unknown
results block a different credit for that account. A subsequent native inventory check can recover
the same request ID; retries never silently create another redemption. Only
recognized server outcomes settle an attempt. Usage percentages and refresh
times are fetched again, not predicted locally.

The home panel shows scheduled reset times on the usage bars. The reset icon
and count open the Banked Reset review for connected Codex accounts reporting
available credit. On a card that has reached its limit, the action appears next to the
account switch control. The provider-wide Possible reset notice comes from the
public outlook and is independent of an account’s banked credits.

## Contract references

These endpoints are used by OpenAI's official client, rather than a guaranteed
stable third-party API:

- https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client/rate_limit_resets.rs
- https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client/rate_limit_resets_tests.rs
- https://help.openai.com/en/articles/20001498-how-resets-work-in-codex

Development verification reads live balances only. Redemption tests use
synthetic responses and injected transport/storage failures; spending a real
reset requires the owner's separate approval.
