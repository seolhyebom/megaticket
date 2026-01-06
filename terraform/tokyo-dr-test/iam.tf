# =============================================================================
# IAM Roles and Policies - DR Tokyo
# =============================================================================

# -----------------------------------------------------------------------------
# EC2 IAM Role (SSM + DynamoDB + Bedrock + CloudWatch)
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-DR-EC2-Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-DR-EC2-Role"
  }
}

# -----------------------------------------------------------------------------
# SSM 관리형 정책 연결
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# -----------------------------------------------------------------------------
# Bedrock 액세스 정책 (인라인) - Converse API + Cross-Region Inference
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "bedrock_policy" {
  name = "${var.project_name}-DR-Bedrock-Policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BedrockInvokeAndConverse"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:Converse",
          "bedrock:ConverseStream"
        ]
        Resource = [
          # Foundation Models (Direct)
          "arn:aws:bedrock:*::foundation-model/anthropic.*",
          "arn:aws:bedrock:*::foundation-model/amazon.*",
          # Cross-Region Inference Profiles (global., apac. prefixes)
          "arn:aws:bedrock:*:*:inference-profile/*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# DynamoDB 최소 권한 정책 (도쿄 리전 - Global Table 복제본)
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "dynamodb_policy" {
  name = "${var.project_name}-DR-DynamoDB-MinimalAccess"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBMinimalAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:TransactWriteItems",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.dynamodb_table_prefix}-*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.dynamodb_table_prefix}-*/index/*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Logs 정책 (인라인)
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "cloudwatch_policy" {
  name = "${var.project_name}-DR-CloudWatch-Policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Instance Profile
# -----------------------------------------------------------------------------
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-DR-EC2-Profile"
  role = aws_iam_role.ec2_role.name
}
