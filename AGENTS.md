<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Signup, resend, and password-reset requests use a public POST server function with same-origin checks and a service-role-only transactional RPC for account lookup and durable limits; client code never accesses Auth users or privileged credentials.
- Confirmation cooldowns are enforced in the database as well as the page; no worker-global state is used for abuse protection.
- Auth email destinations use explicit canonical URL constants, never an incoming request origin for password recovery; the shared auth listener records short-lived, user-bound recovery intent so SDK URL cleanup does not disable the reset form.
