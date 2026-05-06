# Security Specification - SWYN Match

## 1. Data Invariants
- A user document must exist for every authenticated user who has completed onboarding.
- Only users with the `admin` role can list all users or modify other users' roles.
- A user's `email` and `uid` are immutable once created.
- `role` must be either `admin` or `member`.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)
1. **Identity Spoofing**: Attempt to create a user profile with a UID that doesn't match `request.auth.uid`.
2. **Privilege Escalation**: A `member` tries to update their own `role` to `admin`.
3. **PII Leak**: An authenticated user tries to `get` another user's document.
4. **Blanket List**: An authenticated user tries to `list` all users without admin privileges.
5. **Shadow Field Injection**: Adding an `isVerified: true` field to a user document.
6. **ID Poisoning**: Using a 2KB string as a document ID.
7. **Type Confusion**: Setting `role` to `true` (boolean) instead of a string.
8. **Email Spoofing**: Setting `email` to an admin's email during signup.
9. **Creation Gap**: Creating a user document without the `role` field.
10. **Modification of Immutable**: Updating the `email` field of an existing user.
11. **Denial of Wallet**: Sending a massive array in a field to bloat document size.
12. **Unauthenticated Write**: Trying to create a user profile without being signed in.

## 3. Test Runner (Draft)
- `test('non-admin cannot list users')` -> EXPECT PERMISSION_DENIED
- `test('user can read own profile')` -> EXPECT ALLOW
- `test('admin can promote users')` -> EXPECT ALLOW
- `test('member cannot change role')` -> EXPECT PERMISSION_DENIED
