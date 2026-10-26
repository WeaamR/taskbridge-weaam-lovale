# Signup fix
- [x] Add protected account lookup and durable custom rate limits.
- [x] Update signup states, confirmation resend cooldown, and password recovery without redesign.
- [x] Test account states, failures, repeated clicks, and the live page (20 passing tests; confirmed/unconfirmed live checks; concurrent limits and anonymous access checked).
- [ ] Verify successful real-email signup and recovery-link completion — blocked by lack of a controlled deliverable email inbox; synthetic signup was rejected and the page correctly displayed an error.

# Password reset redirect
- [ ] Use the production reset URL explicitly for recovery requests.
- [ ] Handle valid, expired, and invalid recovery links and test password updates.
- [ ] Provide the exact Supabase Site URL and allowed redirect URL.