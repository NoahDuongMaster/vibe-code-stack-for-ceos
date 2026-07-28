terraform {
  required_version = "~> 1.15.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.56.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.22.0"
    }
  }
}
