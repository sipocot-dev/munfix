# Roles and permissions

Authorization is **permission-based**. A role is a named set of permissions stored in the `roles` table; a user has one role (`users.role`). Every API route, page guard and data query checks **permissions**, never role names (`lib/permissions.ts`, `lib/api.ts`, `lib/guards.ts`, `lib/reports.ts`).

## Permissions

| Permission | Allows |
| --- | --- |
| `reports.review` | Put reports under review, publish, hide, restore, reject, mark duplicates |
| `reports.view_private` | See reports that are not public (hidden, rejected, duplicate, awaiting review) and their photos |
| `reports.view_reporter` | See who submitted a report (name and email) |
| `reports.work` | Field work: mark public reports in progress and resolved. Field-work-only roles can be limited to categories |
| `stats.view` | Overview dashboard |
| `audit.view` | Audit log |
| `system.view` | System page and test email |
| `users.manage` | Create accounts, change roles, deactivate, reset passwords |
| `roles.manage` | Create and edit custom roles |

`users.manage` and `roles.manage` control access itself and are marked as such in the UI.

## Built-in roles

Citizen (none), Field staff (`reports.work`), Moderator (`reports.review`, `reports.view_private`, `reports.view_reporter`, `stats.view`), Administrator (all). They reproduce the behaviour of the earlier hard-coded roles, are defined in code (`SYSTEM_ROLES`), seeded by migration 007 and re-synced on every start, and **cannot be edited, disabled or deleted** in the app.

## Custom roles (Admin → Roles)

Administrators (anyone with `roles.manage`) can create a role, name and describe it, choose its permissions, enable or disable it, and see each role's permissions and how many accounts hold it. Assign roles on **Admin → Users** (`users.manage`). Example: an "Auditor" role with `audit.view` and `stats.view` opens Overview and Audit log, and nothing else.

Changes take effect on the **next request** for everyone with the role: permissions are read from the database on every request (memoised for one page render), not stored in the session. A disabled role grants nothing; its holders use MunFix as residents until it is enabled again or they get another role. Disabled roles cannot be assigned.

## Guards against privilege escalation

All of these are enforced in `lib/roles.ts` and `lib/users.ts` on the server; the UI mirrors them only to explain why a control is unavailable.

1. **Within your own access.** Nobody can create a role, add a permission to a role, edit a role, assign a role, or change an account (role, name, deactivation, password reset), unless every permission involved is one they hold. A custom "user manager" can therefore never assign the Administrator role, promote themselves, or reset an administrator's password.
2. **Built-in roles are fixed.**
3. **Your own role is locked.** You cannot edit or disable the role you hold, so an administrator cannot remove their own access by mistake; another administrator must do it.
4. **You cannot change your own role or deactivate yourself.**
5. **The last active administrator** cannot be demoted or deactivated.
6. Every role and account change is written to `admin_actions` and shown in the audit log.
7. A session with a temporary password has no permissions until the password is changed.

Tests: `tests/unit/roles.test.ts` (each guard), `tests/unit/permissions.test.ts` (built-in roles keep their earlier abilities), `e2e/admin.spec.ts` and `e2e/authorization.spec.ts` (the same rules through the real API and pages).

## Database

Migration `007_roles_and_publication.sql` adds `roles (key, name, description, permissions text[], is_system, is_active)` and replaces the `users.role` check constraint with a foreign key to `roles.key`. Role keys are slugs of the name and never change. Custom roles are not deleted, only disabled (deleting would orphan accounts and audit history).
