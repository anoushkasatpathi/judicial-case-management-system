# Terraform deployment skeleton

This directory is a first-pass AWS ECS/Fargate target. It intentionally does not
create a VPC, database, Redis, S3 bucket, or secrets store: those should be
provided by the platform team or a separate foundational module before apply.

The module expects pre-existing subnet/security-group IDs and publishes the API
and web images supplied through variables. Set `enable` to `true` only after
reviewing IAM, networking, backups, TLS, secret injection, and alarms for the
target account.