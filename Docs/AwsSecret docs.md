# AWS Secrets Manager + IAM — Command Reference

This walks through everything we did to fix `invoiceapp-dev-user`'s access to AWS Secrets Manager, in the order we did it. Read top to bottom — later sections build on earlier ones.

---

## 1. The original error

```
aws secretsmanager create-secret --name invoiceapp/DATABASE_URL \
  --secret-string "postgresql://..." --region eu-north-1

AccessDeniedException: User: arn:aws:iam::216016752546:user/invoiceapp-dev-user
is not authorized to perform: secretsmanager:CreateSecret because no
identity-based policy allows the secretsmanager:CreateSecret action
```

**What this means:** IAM is deny-by-default. Nothing in `invoiceapp-dev-user`'s attached policies explicitly allowed `secretsmanager:CreateSecret`, so AWS blocked the call. The fix for any "not authorized to perform X" error is always the same shape: find or write a policy that allows action `X` on the right resource, then attach it to the right identity (user/role).

---

## 2. The policy file: `infra/iam/secrets-access-policy.json`

This is the actual IAM policy document, kept in the repo so it's version-controlled. Final version, with two statements:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:CreateSecret"
      ],
      "Resource": "arn:aws:secretsmanager:eu-north-1:216016752546:secret:invoiceapp/*"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:ListSecrets",
      "Resource": "*"
    }
  ]
}
```

Key things to notice:
- `Effect: Allow` + `Action` + `Resource` is the minimum shape of any statement.
- The first statement is **scoped**: it only applies to secrets whose name starts with `invoiceapp/` (via the ARN wildcard `secret:invoiceapp/*`). This is least-privilege — the user can't touch unrelated secrets.
- `ListSecrets` **cannot** be scoped to a resource — AWS requires `Resource: "*"` for that specific action. This is an AWS limitation, not a choice we made. It means the user can see the *names* of all secrets in the account, but still can't read the *values* of any secret outside `invoiceapp/*` (that's still gated by the first statement).
- Two statements in one policy are just two independent rules; either one matching allows the request.

---

## 3. Two ways to attach a policy to a user

### Option A — Managed policy (what we used)

A managed policy is a standalone object with its own ARN. It can be attached to multiple users/roles, and it supports **versioning** (up to 5 versions, one marked "default"/active).

```bash
# Create it (first time only)
aws iam create-policy \
  --policy-name InvoiceAppSecretsPolicy \
  --policy-document file:///home/hamza/projects/InvoiceAPP/infra/iam/secrets-access-policy.json \
  --description "Scoped access to invoiceapp/* secrets for invoiceapp-dev-user"

# Attach it to the user
aws iam attach-user-policy \
  --user-name invoiceapp-dev-user \
  --policy-arn arn:aws:iam::216016752546:policy/InvoiceAppSecretsPolicy

# Detach it later if needed
aws iam detach-user-policy \
  --user-name invoiceapp-dev-user \
  --policy-arn arn:aws:iam::216016752546:policy/InvoiceAppSecretsPolicy
```

**Important gotcha we hit:** editing the JSON file on disk does NOT change what's live in AWS. `create-policy` only reads the file once, at creation time. Every time you edit the policy file afterward, you must push a **new version**:

```bash
aws iam create-policy-version \
  --policy-arn arn:aws:iam::216016752546:policy/InvoiceAppSecretsPolicy \
  --policy-document file:///home/hamza/projects/InvoiceAPP/infra/iam/secrets-access-policy.json \
  --set-as-default
```

`--set-as-default` is required — without it, the new version exists but isn't actually active, and you'll keep getting denied and wonder why.

### Option B — Inline policy (simpler, single-user, no versioning)

```bash
# Create or overwrite
aws iam put-user-policy \
  --user-name invoiceapp-dev-user \
  --policy-name secrets-access-policy \
  --policy-document file:///home/hamza/projects/InvoiceAPP/infra/iam/secrets-access-policy.json

# Remove
aws iam delete-user-policy \
  --user-name invoiceapp-dev-user \
  --policy-name secrets-access-policy
```

Re-running `put-user-policy` with the same `--policy-name` just overwrites it in place — no version history to manage. Use this for a one-off, single-user grant; use a managed policy (Option A) when it might be reused or you want an audit trail of changes.

---

## 4. Swapping out an over-broad AWS-managed policy

Along the way we discovered `invoiceapp-dev-user` had `SecretsManagerReadWrite` attached (added manually via the AWS Console), which grants access to **every** secret in the account — much broader than needed. We replaced it with the scoped custom policy:

```bash
aws iam attach-user-policy \
  --user-name invoiceapp-dev-user \
  --policy-arn arn:aws:iam::216016752546:policy/InvoiceAppSecretsPolicy

aws iam detach-user-policy \
  --user-name invoiceapp-dev-user \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

Note the ARN format difference: AWS-managed policies live under `arn:aws:iam::aws:policy/...` (no account ID), while your own custom policies live under `arn:aws:iam::<account-id>:policy/...`.

---

## 5. Inspecting current permissions (read-only, safe to run anytime)

```bash
# Managed policies attached to a user
aws iam list-attached-user-policies --user-name invoiceapp-dev-user

# Inline policy names attached to a user
aws iam list-user-policies --user-name invoiceapp-dev-user

# Full content of a specific inline policy
aws iam get-user-policy --user-name invoiceapp-dev-user --policy-name <PolicyName>

# Which version of a managed policy is currently active
aws iam get-policy \
  --policy-arn arn:aws:iam::216016752546:policy/InvoiceAppSecretsPolicy \
  --query "Policy.DefaultVersionId" --output text

# Full JSON content of a specific policy version
aws iam get-policy-version \
  --policy-arn arn:aws:iam::216016752546:policy/InvoiceAppSecretsPolicy \
  --version-id v3

# All versions that exist for a policy (max 5 kept)
aws iam list-policy-versions \
  --policy-arn arn:aws:iam::216016752546:policy/InvoiceAppSecretsPolicy

# Whether a permissions boundary is capping this user's effective access
aws iam get-user --user-name invoiceapp-dev-user --query "User.PermissionsBoundary"
```

A **permissions boundary** (if set) acts as a ceiling: even if an identity policy allows an action, the boundary can still block it. It came back `null` for us, meaning there's no boundary in play — ruled out as a cause.

---

## 6. The single most useful debugging tool: the policy simulator

Instead of guessing why an action is denied, ask AWS directly:

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::216016752546:user/invoiceapp-dev-user \
  --action-names secretsmanager:ListSecrets \
  --query "EvaluationResults[].{Decision:EvalDecision,Action:EvalActionName,MatchedStatements:MatchedStatements}"
```

- `Decision: allowed` — some attached policy grants it; `MatchedStatements` shows which one.
- `Decision: implicitDeny` — no policy grants it (the default IAM state; nothing is explicitly denying, there's just no allow).
- `Decision: explicitDeny` — some policy has a `"Effect": "Deny"` statement that overrides any allow. Explicit deny always wins, no matter how many other policies allow the action.

This is the fastest way to debug "why am I still denied" — swap in any `--action-names` you're troubleshooting.

---

## 7. Actually using Secrets Manager

```bash
# Create a new secret
aws secretsmanager create-secret \
  --name invoiceapp/DATABASE_URL \
  --secret-string "postgresql://user:pass@host:5432/db" \
  --region eu-north-1

# List secrets (optionally filtered by name prefix)
aws secretsmanager list-secrets \
  --region eu-north-1 \
  --filters Key=name,Values=invoiceapp/ \
  --query "SecretList[].Name"

# Read a secret's value (requires GetSecretValue)
aws secretsmanager get-secret-value \
  --secret-id invoiceapp/DATABASE_URL \
  --region eu-north-1 \
  --query "SecretString" --output text
```

`ResourceExistsException` on `create-secret` just means the secret already exists — that's not a permissions problem, it's expected once you've created it once.

---

## 8. Open item — not yet fixed

`invoiceapp-dev-user` still has several overly broad policies attached, most notably **`IAMFullAccess`**, which lets this user create new IAM users/roles or attach `AdministratorAccess` to itself. That's a privilege-escalation risk if these credentials ever leak. This was intentionally left alone for now — worth a dedicated cleanup pass later using the same attach/detach pattern shown in Section 4.