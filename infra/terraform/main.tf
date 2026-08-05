# OpenTofu (open-source Terraform fork) configuration provisioning the
# infrastructure that was set up manually via the AWS Console during this
# project's deployment. This is the direct implementation of
# "Infrastructure as Code (IaC): cloud environments are provisioned
# declaratively using OpenTofu" from the proposal.
#
# WHY THIS MATTERS EVEN THOUGH THE EC2 INSTANCE ALREADY EXISTS: the value
# of IaC isn't the first provision, it's that the *next* environment
# (staging, a second society, disaster recovery) is `tofu apply` instead
# of another multi-hour manual click-through session. This file documents
# infrastructure as reviewable, versioned code instead of tribal knowledge
# of which buttons were clicked in which order.
#
# This does NOT retroactively re-provision the existing instance -- doing
# so would destroy and recreate it, losing the running containers and
# data. See infra/terraform/README.md for adopting an existing resource
# via `tofu import`, versus using this fresh for a new environment.

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-2"
}

variable "instance_type" {
  description = "EC2 instance size. t3.medium is the practical minimum once Kubernetes + monitoring + logging run alongside the app -- a t2.micro (free tier) does not have enough memory for this full stack."
  type        = string
  default     = "t3.medium"
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}

variable "ssh_allowed_cidr" {
  description = "CIDR allowed to SSH in -- lock this to your own IP, not 0.0.0.0/0, once class demos are done"
  type        = string
  default     = "0.0.0.0/0"
}

# Security group -- codifies exactly the manual changes made during this
# project's deployment (open 80/443/22, nothing else), so "close the ports
# we don't need" is enforced by code, not memory.
resource "aws_security_group" "ams_sg" {
  name        = "apartment-system-sg"
  description = "Apartment Management System - web + SSH only"

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "apartment-system-sg" }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "ams_server" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  vpc_security_group_ids = [aws_security_group.ams_sg.id]

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = { Name = "apartment-system" }
}

# Elastic IP -- this is the fix for the exact problem hit mid-project (the
# public IP changing on every instance stop/start). Codifying it here
# means it can never be forgotten on a future environment.
resource "aws_eip" "ams_eip" {
  instance = aws_instance.ams_server.id
  domain   = "vpc"
  tags     = { Name = "apartment-system-eip" }
}

output "instance_public_ip" {
  value = aws_eip.ams_eip.public_ip
}

output "ssh_command" {
  value = "ssh -i <your-key>.pem ec2-user@${aws_eip.ams_eip.public_ip}"
}
