# Adopting an existing EC2 instance vs. provisioning fresh

If you already have a manually-created EC2 instance (e.g. from earlier in
this project) and want to bring it under Terraform/OpenTofu management
without destroying and recreating it, use `import`:

```bash
tofu import aws_instance.ams_server i-0123456789abcdef0
tofu import aws_security_group.ams_sg sg-0123456789abcdef0
tofu plan
```

`tofu plan` after an import will likely show some differences between
main.tf's definition and the real resource's exact current settings
(tags, exact security group rule ordering, etc.) -- reconcile main.tf to
match reality rather than blindly running `apply`, or `apply` will change
your live infrastructure to match the file, which may not be what you
want on a resource you're adopting rather than creating fresh.

For a class demo, provisioning fresh with `tofu apply` (no import) is
simpler and safer -- it guarantees the infrastructure state and the code
are identical from the start, which is the actual point being
demonstrated.
