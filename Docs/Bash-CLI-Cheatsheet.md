# Bash / Shell / AWS CLI Cheat Sheet

A reference for running the AWS setup commands (and general terminal work) without
the class of mistakes that keep showing up — mainly: leaving placeholder text in a
command instead of the real value, and forgetting `$` when using a variable.

---

## 1. Variables

### Setting a variable
```bash
MY_VAR=hello        # no spaces around =, this is required
```
This sets a variable for the current shell only — it is **not** exported to
sub-processes (like a script you run, or a program the shell launches).

### Exporting a variable
```bash
export MY_VAR=hello
```
`export` makes the variable available to any child process launched from this
shell — e.g. if `MY_VAR` needs to be visible inside a script you call, or inside
`aws` itself (rare, but some tools do read env vars). For simply reusing a value
across several `aws ec2 ...` commands you type yourself, plain `MY_VAR=hello`
would technically work too, but **always use `export`** for values you'll reuse —
it's one extra word and removes an entire category of "why isn't this working"
bugs when a command is later wrapped in a script or subshell.

### Reading a variable — the `$` is not optional
```bash
export VPC_ID=vpc-028c172363bd56102

echo VPC_ID        # prints the literal text: VPC_ID
echo $VPC_ID        # prints the value: vpc-028c172363bd56102
```
This is the single most common mistake in the AWS setup steps: typing
`--vpc-id VPC_ID` instead of `--vpc-id $VPC_ID`. Without the `$`, bash treats it
as a plain string, not a variable reference, and AWS will reject it (or worse,
silently treat it as some literal ID that doesn't exist — you'll see
`InvalidGroupId.Malformed` or `does not exist` errors).

### Curly-brace form `${VAR}`
```bash
echo "${VPC_ID}-backup"     # vpc-028c172363bd56102-backup
echo "$VPC_ID-backup"       # same result here, but risky in general
```
Use `${VAR}` instead of `$VAR` when the variable name would otherwise blur into
the surrounding text, e.g. `${VAR}_suffix` (bash would otherwise try to read a
variable literally named `VAR_suffix`, which doesn't exist, and silently expand
to nothing).

### Checking what a variable actually holds (debug before you run)
```bash
echo $ALB_SG
```
If this prints nothing, the variable is unset or was only set in a *different*
terminal tab/session (variables don't persist across terminals — see §5).
**Get in the habit of `echo`-ing a variable right before using it in a
destructive or hard-to-undo AWS command.**

### Listing all exported variables
```bash
export -p            # every exported variable and its value
env                   # similar, slightly different format
```
Useful for confirming `AWS_REGION`, `VPC_ID`, etc. are actually set before a long
command.

### Unsetting a variable
```bash
unset VPC_ID
```

---

## 2. `echo` — printing text and variables

```bash
echo "hello"                     # hello
echo hello                       # hello (quotes optional for simple strings)
echo "VPC is $VPC_ID"            # VPC is vpc-028c172363bd56102  (expands inside double quotes)
echo 'VPC is $VPC_ID'            # VPC is $VPC_ID                (single quotes = no expansion)
```
**Double quotes expand variables. Single quotes do not.** This trips people up
constantly — if you want the literal value substituted, use double quotes (or no
quotes for a single word); if you want the raw text `$VPC_ID` printed as-is
(e.g. showing someone an example command), use single quotes.

`echo` with flags:
```bash
echo -n "no newline after this"   # -n suppresses the trailing newline
echo -e "line1\nline2"            # -e enables backslash escapes like \n
```

---

## 3. Quoting rules (this matters a lot for AWS CLI JSON arguments)

| Quote style | Variable expansion? | When to use |
|---|---|---|
| `"double quotes"` | Yes | Default choice for anything with a variable or spaces |
| `'single quotes'` | No | Literal strings, JSON snippets, anything with `$` you don't want expanded |
| no quotes | Yes, but word-splits on spaces | Only safe for single words with no spaces |

Example from the ALB listener command:
```bash
aws elbv2 create-listener \
  --default-actions '[{"Type":"redirect","RedirectConfig":{"Protocol":"HTTPS","Port":"443","StatusCode":"HTTP_301"}}]'
```
This is wrapped in **single** quotes because it's a literal JSON blob with no
variables inside — if it contained `$TG_ARN`, you'd need double quotes instead
(and then you'd have to escape the inner double quotes with `\"`, which gets
messy — this is why for anything non-trivial, AWS CLI commands read the JSON
from a **file** instead, see §4).

Always quote variables that might contain a path, ARN, or anything with special
characters:
```bash
aws ecs describe-services --cluster invoiceapp-cluster --services "$ECS_SERVICE"
```

---

## 4. `file://` — passing file contents as a CLI argument

Several AWS CLI commands in this setup take JSON from a file instead of inline
text, e.g.:
```bash
aws iam create-role --assume-role-policy-document file://infra/iam/trust-ecs-tasks.json
```
- `file://` is relative to your **current working directory** in the terminal —
  run `pwd` first if you're not sure where you are, and `ls` the path to confirm
  the file exists before running the command.
- Use an absolute path if you're not certain of your working directory:
  `file:///home/hamza/projects/InvoiceAPP/infra/iam/trust-ecs-tasks.json`
- This is also why the Google credentials secret used `file://` instead of typing
  the JSON inline — trying to inline a multi-line JSON key file as a quoted CLI
  argument is a common source of malformed-JSON errors.

---

## 5. Terminal sessions and variable persistence

**Exported variables only live in the terminal session (shell process) they were
created in.** If you:
- open a new terminal tab
- open a new SSH session
- close and reopen your terminal
- run a script in a new subshell

...then `$VPC_ID` (and everything else you exported) is gone. You'll need to
re-export it, or `echo $VPC_ID` will silently print nothing.

To make variables survive across sessions during a long setup like this AWS
walkthrough, keep a scratch file with all your resource IDs and re-source it in
each new terminal:

```bash
# save to e.g. ~/invoiceapp-aws-vars.sh as you go:
export AWS_REGION=eu-north-1
export ACCOUNT_ID=216016752546
export VPC_ID=vpc-028c172363bd56102
export SUBNET_A=subnet-0c00febf7121b1567   # eu-north-1a
export SUBNET_B=subnet-00de94a9df5b8b887   # eu-north-1b
export ALB_SG=sg-01adb15b145336b71
export ECS_SG=sg-0d169c025aac1098c
# ...append more as you create them (TG_ARN, ALB_ARN, CERT_ARN, etc.)

# then in any new terminal, before running AWS commands:
source ~/invoiceapp-aws-vars.sh
```
`source` (or the shorthand `.`) re-runs the script *in your current shell*
(rather than a subshell), so the `export`s actually stick around afterward.

---

## 6. Command substitution — capturing a command's output into a variable

Instead of manually copy-pasting an ID out of JSON output, you can capture it
directly:
```bash
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" --output text --region eu-north-1)

echo $VPC_ID
```
`$(...)` runs the command inside and substitutes its stdout output as text. This
is the fix for the exact mistake that kept happening — instead of eyeballing the
output and retyping the ID (and risking leaving a placeholder in), the variable
gets set directly from the real output, every time.

Backticks `` `command` `` do the same thing as `$(...)` but are harder to read
and nest — prefer `$(...)` always.

---

## 7. `--query` and `--output` (AWS CLI's built-in JSON filtering)

AWS CLI uses [JMESPath](https://jmespath.org/) for `--query`. A few patterns
that cover most of what you need:

```bash
--query "Vpcs[0].VpcId"                     # first element's field
--query "Subnets[].SubnetId"                # every element's field, as a list
--query "Subnets[].{ID:SubnetId,AZ:AvailabilityZone}"   # reshape into a table
--query "services[0].{status:status,running:runningCount}"
```

`--output` controls the format:
```bash
--output text     # plain value, good for capturing into a variable with $(...)
--output table     # human-readable table, good for eyeballing in the terminal
--output json      # full JSON, good for piping into jq
```

Rule of thumb: **`--output text` when the result feeds into a variable or
another command; `--output table` when a human is reading it.**

---

## 8. `jq` — filtering JSON on the command line

If a command doesn't have a `--query`, or you want more control, pipe JSON
output through `jq`:
```bash
aws ecs describe-services --cluster invoiceapp-cluster --services invoiceapp-backend-service \
  --output json | jq '.services[0].status'

aws secretsmanager list-secrets --region eu-north-1 | jq -r '.SecretList[].Name'
```
`-r` prints raw strings (no surrounding quotes) — usually what you want when
piping the result into another command or a variable.

---

## 9. Pipes `|` and redirection `>` `>>`

```bash
command1 | command2      # feed command1's output as command2's input
command > file.txt        # overwrite file.txt with command's output
command >> file.txt       # append to file.txt
command 2> errors.txt     # redirect only stderr (errors) to a file
command > out.txt 2>&1    # redirect both stdout and stderr to the same file
```
Example: saving the full JSON output of a command for later reference instead of
losing it in scrollback:
```bash
aws ecs describe-task-definition --task-definition invoiceapp-backend \
  --region eu-north-1 > infra/last-registered-task-def.json
```

---

## 10. `grep` — searching text/output

```bash
aws ecs list-tasks --cluster invoiceapp-cluster --region eu-north-1 | grep taskArn
grep -i error logfile.txt        # -i = case-insensitive
grep -r "DATABASE_URL" backend/  # -r = recursive through a directory
grep -n "GOOGLE_APPLICATION" backend/entrypoint.sh   # -n = show line numbers
```

---

## 11. Exit codes and chaining commands

```bash
command1 && command2    # run command2 ONLY if command1 succeeded (exit code 0)
command1 || command2    # run command2 ONLY if command1 FAILED
command1 ; command2     # run command2 regardless of command1's result
echo $?                  # print the exit code of the last command (0 = success)
```
Useful when you want a command to only proceed if the previous AWS call actually
worked:
```bash
aws ecr create-repository --repository-name invoiceapp-backend --region eu-north-1 \
  && echo "repo created successfully"
```

---

## 12. Common AWS CLI troubleshooting patterns

**"Which account/region am I actually pointed at?"**
```bash
aws sts get-caller-identity
```
Prints your account ID, user/role ARN, and confirms your credentials are valid —
run this first if anything is behaving unexpectedly.

**"Did my resource actually get created?"**
Always re-describe after creating something instead of assuming success:
```bash
aws ec2 describe-security-groups --group-ids $ECS_SG --region eu-north-1
aws ecs describe-services --cluster invoiceapp-cluster --services invoiceapp-backend-service --region eu-north-1
```

**"Malformed ID" errors** — 95% of the time this means a placeholder (like
`sg-ecs222` or `vpc-0abc123`) was left in literally instead of being replaced
with a real returned ID, or a `$` was missing before a variable name. Re-check
the exact command against `echo $VARNAME` before re-running.

**Region mismatches** — if a resource "doesn't exist" but you're sure you
created it, check you're querying the same `--region` you created it in. Set a
default to avoid this:
```bash
export AWS_REGION=eu-north-1
export AWS_DEFAULT_REGION=eu-north-1
```
Then you can drop `--region eu-north-1` from every command.

---

## 13. Quick reference table

| Task | Command |
|---|---|
| Set a variable for this shell only | `VAR=value` |
| Set + export (visible to sub-processes) | `export VAR=value` |
| Read a variable | `echo $VAR` or `echo "$VAR"` |
| Read with disambiguation | `echo "${VAR}_suffix"` |
| Capture command output into a variable | `VAR=$(command)` |
| Check if a variable is set | `echo $VAR` (empty output = unset) |
| List all exported variables | `export -p` |
| Persist variables across terminals | save to a `.sh` file, `source` it in new sessions |
| Pass a JSON file as a CLI arg | `--some-flag file://path/to/file.json` |
| Filter AWS CLI JSON output | `--query "JMESPath.expression"` |
| Pipe/filter JSON with more control | `... \| jq '.field'` |
| Save output to a file | `command > file.txt` |
| Only run next command if previous succeeded | `command1 && command2` |
| Check last command's success/failure | `echo $?` (0 = success) |
| Confirm which AWS account/region you're using | `aws sts get-caller-identity` |

---

## 14. This project's resource IDs so far

Fill this in as you go through the AWS setup — keep it updated so you (or a
future terminal session) always have the real values on hand instead of
placeholders.

```bash
export AWS_REGION=eu-north-1
export ACCOUNT_ID=216016752546
export VPC_ID=vpc-028c172363bd56102
export SUBNET_A=subnet-0c00febf7121b1567   # eu-north-1a
export SUBNET_B=subnet-00de94a9df5b8b887   # eu-north-1b
export ALB_SG=sg-01adb15b145336b71
export ECS_SG=sg-0d169c025aac1098c
# export TG_ARN=...
# export ALB_ARN=...
# export CERT_ARN=...
```
