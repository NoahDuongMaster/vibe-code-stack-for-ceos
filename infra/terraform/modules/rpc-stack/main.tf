data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_ssm_parameter" "amazon_linux_ami" {
  name = var.ec2_ami_ssm_parameter
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  azs         = slice(data.aws_availability_zones.available.names, 0, 1)

  public_subnets = {
    for index, availability_zone in local.azs :
    availability_zone => cidrsubnet(var.vpc_cidr, 4, index)
  }
  private_subnets = {
    for index, availability_zone in local.azs :
    availability_zone => cidrsubnet(var.vpc_cidr, 4, index + 4)
  }
  common_tags = {
    Application = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  compose_path          = "${path.module}/../../../docker/compose.ec2.yaml"
  deploy_script_path    = "${path.module}/files/deploy.sh"
  monitor_script_path   = "${path.module}/files/monitor.sh"
  compose_sha256        = filesha256(local.compose_path)
  deploy_script_sha256  = filesha256(local.deploy_script_path)
  monitor_script_sha256 = filesha256(local.monitor_script_path)
  docker_compose_url    = "https://github.com/docker/compose/releases/download/${var.docker_compose_version}/docker-compose-linux-x86_64"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value
  map_public_ip_on_launch = false

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${each.key}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value
  map_public_ip_on_launch = false

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-${each.key}"
    Tier = "application"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-public" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  route_table_id = aws_route_table.public.id
  subnet_id      = each.value.id
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-nat" })

  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[local.azs[0]].id
  tags          = merge(local.common_tags, { Name = "${local.name_prefix}-nat" })

  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "private" {
  for_each = aws_subnet.private

  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-private-${each.key}" })
}

resource "aws_route" "private_internet" {
  for_each = aws_route_table.private

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  route_table_id = aws_route_table.private[each.key].id
  subnet_id      = each.value.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = values(aws_route_table.private)[*].id

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-s3" })
}

resource "aws_security_group" "rpc_host" {
  name        = "${local.name_prefix}-rpc-host"
  description = "No public ingress; RPC traffic enters through outbound Cloudflare Tunnel"
  vpc_id      = aws_vpc.this.id

  egress {
    description = "Runtime HTTPS, QUIC, DNS, ECR, SSM, and database egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-rpc-host" })
}

data "aws_iam_policy_document" "runtime_kms" {
  statement {
    sid       = "EnableAccountIAMPolicies"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  statement {
    sid = "AllowCloudWatchLogs"
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*",
    ]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${var.aws_region}.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/${var.project_name}/${var.environment}/*"]
    }
  }

  statement {
    sid = "AllowCloudWatchAlarmNotifications"
    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey*",
    ]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com", "sns.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_kms_key" "runtime" {
  description             = "${local.name_prefix} RPC runtime secrets, logs, and EBS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.runtime_kms.json

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_kms_alias" "runtime" {
  name          = "alias/${local.name_prefix}-rpc-runtime"
  target_key_id = aws_kms_key.runtime.key_id
}

resource "aws_kms_key" "backup_manifest" {
  description              = "${local.name_prefix} PostgreSQL monthly-backup manifest authentication"
  key_usage                = "GENERATE_VERIFY_MAC"
  customer_master_key_spec = "HMAC_256"
  deletion_window_in_days  = 30

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_kms_alias" "backup_manifest" {
  name          = "alias/${local.name_prefix}-postgres-backup-auth"
  target_key_id = aws_kms_key.backup_manifest.key_id
}

resource "aws_s3_bucket" "bootstrap_assets" {
  bucket_prefix = "${local.name_prefix}-rpc-assets-"
  tags          = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "bootstrap_assets" {
  bucket = aws_s3_bucket.bootstrap_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bootstrap_assets" {
  bucket = aws_s3_bucket.bootstrap_assets.id

  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.runtime.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "bootstrap_assets" {
  bucket = aws_s3_bucket.bootstrap_assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_iam_policy_document" "bootstrap_assets" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.bootstrap_assets.arn,
      "${aws_s3_bucket.bootstrap_assets.arn}/*",
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "bootstrap_assets" {
  bucket = aws_s3_bucket.bootstrap_assets.id
  policy = data.aws_iam_policy_document.bootstrap_assets.json

  depends_on = [aws_s3_bucket_public_access_block.bootstrap_assets]
}

resource "aws_s3_object" "compose" {
  bucket      = aws_s3_bucket.bootstrap_assets.id
  key         = "bootstrap/${local.compose_sha256}/compose.yaml"
  source      = local.compose_path
  source_hash = local.compose_sha256
  kms_key_id  = aws_kms_key.runtime.arn
}

resource "aws_s3_object" "deploy_script" {
  bucket      = aws_s3_bucket.bootstrap_assets.id
  key         = "bootstrap/${local.deploy_script_sha256}/deploy.sh"
  source      = local.deploy_script_path
  source_hash = local.deploy_script_sha256
  kms_key_id  = aws_kms_key.runtime.arn
}

resource "aws_s3_object" "monitor_script" {
  bucket      = aws_s3_bucket.bootstrap_assets.id
  key         = "bootstrap/${local.monitor_script_sha256}/monitor.sh"
  source      = local.monitor_script_path
  source_hash = local.monitor_script_sha256
  kms_key_id  = aws_kms_key.runtime.arn
}

resource "aws_ecr_repository" "rpc" {
  for_each = toset(["admin-rpc", "postgres", "trading-rpc"])

  name                 = "${local.name_prefix}/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "rpc" {
  for_each = aws_ecr_repository.rpc

  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after seven days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Retain the newest 50 immutable releases"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 50
        }
        action = { type = "expire" }
      }
    ]
  })
}

resource "aws_secretsmanager_secret" "runtime" {
  name                    = "/${var.project_name}/${var.environment}/rpc-runtime"
  description             = "RPC, PostgreSQL, R2, and Cloudflare Tunnel runtime secrets; value is seeded by CI"
  kms_key_id              = aws_kms_key.runtime.arn
  recovery_window_in_days = var.environment == "production" ? 30 : 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "backup_recovery" {
  name                    = "/${var.project_name}/${var.environment}/postgres-backup-age-identity"
  description             = "Raw age identity used only by authenticated PostgreSQL restore drills"
  kms_key_id              = aws_kms_key.runtime.arn
  recovery_window_in_days = var.environment == "production" ? 30 : 7

  tags = local.common_tags
}

locals {
  postgres_volumes = {
    data = {
      device_name = "/dev/sdf"
      mount_path  = "/srv/vibe-rpc/postgres"
      size        = var.postgres_data_volume_size_gib
    }
    backup_stage = {
      device_name = "/dev/sdg"
      mount_path  = "/srv/vibe-rpc/backup-stage"
      size        = var.postgres_backup_stage_volume_size_gib
    }
    restore_stage = {
      device_name = "/dev/sdh"
      mount_path  = "/srv/vibe-rpc/restore-stage"
      size        = var.postgres_restore_stage_volume_size_gib
    }
  }
}

resource "aws_ebs_volume" "postgres" {
  for_each = local.postgres_volumes

  availability_zone = local.azs[0]
  encrypted         = true
  kms_key_id        = aws_kms_key.runtime.arn
  size              = each.value.size
  type              = "gp3"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres-${replace(each.key, "_", "-")}"
    Role = "postgres-persistent-storage"
  })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ssm_parameter" "desired_image_tag" {
  name        = "/${var.project_name}/${var.environment}/rpc/desired-image-tag"
  description = "Immutable ECR tag that every RPC EC2 host must run"
  type        = "String"
  value       = "bootstrap-pending"

  lifecycle {
    ignore_changes = [value]
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "containers" {
  for_each = toset(["admin-rpc", "cloudflared", "postgres", "postgres-backup", "trading-rpc"])

  name              = "/${var.project_name}/${var.environment}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.runtime.arn

  tags = local.common_tags
}

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rpc_host" {
  name               = "${local.name_prefix}-rpc-host"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.rpc_host.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "rpc_host" {
  statement {
    sid       = "EcrAuthorization"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PullDeploymentImages"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = values(aws_ecr_repository.rpc)[*].arn
  }

  statement {
    sid       = "ReadRuntimeSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.runtime.arn, aws_secretsmanager_secret.backup_recovery.arn]
  }

  statement {
    sid       = "DecryptRuntimeSecrets"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.runtime.arn]
  }

  statement {
    sid       = "AuthenticateBackupManifests"
    actions   = ["kms:GenerateMac", "kms:VerifyMac"]
    resources = [aws_kms_key.backup_manifest.arn]
  }

  statement {
    sid       = "ReadDesiredRelease"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.desired_image_tag.arn]
  }

  statement {
    sid     = "ReadBootstrapAssets"
    actions = ["s3:GetObject"]
    resources = [
      aws_s3_object.compose.arn,
      aws_s3_object.deploy_script.arn,
      aws_s3_object.monitor_script.arn,
    ]
  }

  statement {
    sid       = "PublishOperationalMetrics"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["VibeCodeStack/RpcHost"]
    }
  }

  statement {
    sid = "WriteContainerLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
    ]
    resources = [for group in aws_cloudwatch_log_group.containers : "${group.arn}:*"]
  }
}

resource "aws_iam_role_policy" "rpc_host" {
  name   = "rpc-runtime"
  role   = aws_iam_role.rpc_host.id
  policy = data.aws_iam_policy_document.rpc_host.json
}

resource "aws_iam_instance_profile" "rpc_host" {
  name = "${local.name_prefix}-rpc-host"
  role = aws_iam_role.rpc_host.name
}

resource "aws_instance" "rpc" {
  ami                         = data.aws_ssm_parameter.amazon_linux_ami.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.private[local.azs[0]].id
  vpc_security_group_ids      = [aws_security_group.rpc_host.id]
  associate_public_ip_address = false
  iam_instance_profile        = aws_iam_instance_profile.rpc_host.name
  ebs_optimized               = true
  monitoring                  = true

  user_data = templatefile("${path.module}/files/bootstrap.sh.tftpl", {
    admin_rpc_log_group              = aws_cloudwatch_log_group.containers["admin-rpc"].name
    admin_rpc_repository_url         = aws_ecr_repository.rpc["admin-rpc"].repository_url
    aws_region                       = var.aws_region
    backup_manifest_kms_key_arn      = aws_kms_key.backup_manifest.arn
    backup_recovery_secret_arn       = aws_secretsmanager_secret.backup_recovery.arn
    bootstrap_assets_bucket          = aws_s3_bucket.bootstrap_assets.id
    cloudflared_image                = var.cloudflared_image
    cloudflared_log_group            = aws_cloudwatch_log_group.containers["cloudflared"].name
    compose_key                      = aws_s3_object.compose.key
    compose_sha256                   = local.compose_sha256
    database_pool_max                = var.database_pool_max
    deploy_script_key                = aws_s3_object.deploy_script.key
    deploy_script_sha256             = local.deploy_script_sha256
    desired_image_tag_parameter_name = aws_ssm_parameter.desired_image_tag.name
    docker_compose_sha256            = var.docker_compose_linux_x86_64_sha256
    docker_compose_url               = local.docker_compose_url
    environment                      = var.environment
    monitor_script_key               = aws_s3_object.monitor_script.key
    monitor_script_sha256            = local.monitor_script_sha256
    postgres_backup_log_group        = aws_cloudwatch_log_group.containers["postgres-backup"].name
    postgres_backup_stage_volume_id  = aws_ebs_volume.postgres["backup_stage"].id
    postgres_data_volume_id          = aws_ebs_volume.postgres["data"].id
    postgres_log_group               = aws_cloudwatch_log_group.containers["postgres"].name
    postgres_repository_url          = aws_ecr_repository.rpc["postgres"].repository_url
    postgres_restore_stage_volume_id = aws_ebs_volume.postgres["restore_stage"].id
    runtime_secret_arn               = aws_secretsmanager_secret.runtime.arn
    trading_rpc_log_group            = aws_cloudwatch_log_group.containers["trading-rpc"].name
    trading_rpc_repository_url       = aws_ecr_repository.rpc["trading-rpc"].repository_url
  })
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_protocol_ipv6          = "disabled"
    http_put_response_hop_limit = 2
    http_tokens                 = "required"
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    delete_on_termination = true
    encrypted             = true
    kms_key_id            = aws_kms_key.runtime.arn
    volume_size           = var.root_volume_size_gib
    volume_type           = "gp3"
    tags = merge(local.common_tags, {
      Name = "${local.name_prefix}-rpc-root"
      Role = "rpc-host"
    })
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rpc"
    Role = "rpc-host"
  })

  depends_on = [aws_iam_role_policy.rpc_host, aws_s3_bucket_policy.bootstrap_assets]
}

resource "aws_volume_attachment" "postgres" {
  for_each = local.postgres_volumes

  device_name                    = each.value.device_name
  instance_id                    = aws_instance.rpc.id
  stop_instance_before_detaching = true
  volume_id                      = aws_ebs_volume.postgres[each.key].id
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "rpc" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-rpc"
  config_src = "cloudflare"
}

resource "cloudflare_connectivity_directory_service" "trading_rpc" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-trading-rpc"
  type       = "http"
  http_port  = 3001
  host = {
    hostname = "trading-rpc.internal"
    resolver_network = {
      tunnel_id = cloudflare_zero_trust_tunnel_cloudflared.rpc.id
    }
  }
}

resource "cloudflare_connectivity_directory_service" "admin_rpc" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-admin-rpc"
  type       = "http"
  http_port  = 3001
  host = {
    hostname = "admin-rpc.internal"
    resolver_network = {
      tunnel_id = cloudflare_zero_trust_tunnel_cloudflared.rpc.id
    }
  }
}

data "aws_iam_policy_document" "github_deploy_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:${var.environment}"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "${local.name_prefix}-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_deploy_assume_role.json
  max_session_duration = 3600
  tags                 = local.common_tags
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "EcrAuthorization"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PushDeploymentImages"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImageScanFindings",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = values(aws_ecr_repository.rpc)[*].arn
  }

  statement {
    sid       = "SeedRuntimeSecret"
    actions   = ["secretsmanager:PutSecretValue"]
    resources = [aws_secretsmanager_secret.runtime.arn, aws_secretsmanager_secret.backup_recovery.arn]
  }

  statement {
    sid       = "EncryptRuntimeSecret"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.runtime.arn]
  }

  statement {
    sid       = "SetDesiredRelease"
    actions   = ["ssm:PutParameter"]
    resources = [aws_ssm_parameter.desired_image_tag.arn]
  }

  statement {
    sid       = "UseRunShellDocument"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"]
  }

  statement {
    sid       = "DeployToEnvironmentInstances"
    actions   = ["ssm:SendCommand"]
    resources = [aws_instance.rpc.arn]
  }

  statement {
    sid = "ReadDeploymentStatus"
    actions = [
      "ssm:DescribeInstanceInformation",
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
    ]
    resources = ["*"]
  }

  statement {
    sid     = "ReadTerraformState"
    actions = ["s3:GetObject"]
    resources = [
      "arn:aws:s3:::${var.terraform_state_bucket_name}/rpc/${var.environment}.tfstate",
      "arn:aws:s3:::${var.terraform_state_bucket_name}/rpc/${var.environment}.tfstate.tflock",
    ]
  }

  statement {
    sid       = "ListTerraformStateBucket"
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${var.terraform_state_bucket_name}"]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values = [
        "rpc/${var.environment}.tfstate",
        "rpc/${var.environment}.tfstate.tflock",
      ]
    }
  }

  statement {
    sid       = "DecryptTerraformState"
    actions   = ["kms:Decrypt"]
    resources = [var.terraform_state_kms_key_arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "rpc-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}

resource "aws_sns_topic" "operations" {
  name              = "${local.name_prefix}-operations"
  kms_master_key_id = aws_kms_key.runtime.arn
  tags              = local.common_tags
}

resource "aws_sns_topic_subscription" "operations_email" {
  topic_arn = aws_sns_topic.operations.arn
  protocol  = "email"
  endpoint  = var.operations_alert_email
}

resource "aws_cloudwatch_metric_alarm" "instance_system_status" {
  alarm_name          = "${local.name_prefix}-rpc-system-status"
  alarm_description   = "Recover the RPC host after an EC2 system status-check failure"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "missing"
  alarm_actions = [
    "arn:aws:automate:${var.aws_region}:ec2:recover",
    aws_sns_topic.operations.arn,
  ]
  ok_actions = [aws_sns_topic.operations.arn]

  dimensions = {
    InstanceId = aws_instance.rpc.id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "instance_status" {
  alarm_name          = "${local.name_prefix}-rpc-instance-status"
  alarm_description   = "RPC host failed its EC2 instance status check"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_Instance"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "missing"
  alarm_actions       = [aws_sns_topic.operations.arn]
  ok_actions          = [aws_sns_topic.operations.arn]

  dimensions = {
    InstanceId = aws_instance.rpc.id
  }

  tags = local.common_tags
}

locals {
  operational_alarms = {
    backup = {
      comparison_operator = "LessThanThreshold"
      description         = "PostgreSQL backup or restore-drill health is missing or unhealthy"
      metric_name         = "BackupHealthy"
      statistic           = "Minimum"
      threshold           = 1
    }
    containers = {
      comparison_operator = "LessThanThreshold"
      description         = "One or more required RPC host containers are not healthy"
      metric_name         = "ContainersHealthy"
      statistic           = "Minimum"
      threshold           = 1
    }
    disk = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      description         = "Maximum RPC host filesystem utilization is at least 85 percent"
      metric_name         = "DiskUsedPercent"
      statistic           = "Maximum"
      threshold           = 85
    }
    inodes = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      description         = "Maximum RPC host inode utilization is at least 85 percent"
      metric_name         = "InodeUsedPercent"
      statistic           = "Maximum"
      threshold           = 85
    }
    memory = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      description         = "RPC host memory utilization is at least 90 percent"
      metric_name         = "MemoryUsedPercent"
      statistic           = "Maximum"
      threshold           = 90
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "operations" {
  for_each = local.operational_alarms

  alarm_name          = "${local.name_prefix}-rpc-${each.key}"
  alarm_description   = each.value.description
  namespace           = "VibeCodeStack/RpcHost"
  metric_name         = each.value.metric_name
  statistic           = each.value.statistic
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = each.value.threshold
  comparison_operator = each.value.comparison_operator
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.operations.arn]
  ok_actions          = [aws_sns_topic.operations.arn]

  dimensions = {
    Environment = var.environment
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${local.name_prefix}-rpc-cpu"
  alarm_description   = "RPC host CPU utilization is at least 85 percent"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  threshold           = 85
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.operations.arn]
  ok_actions          = [aws_sns_topic.operations.arn]

  dimensions = {
    InstanceId = aws_instance.rpc.id
  }

  tags = local.common_tags
}
