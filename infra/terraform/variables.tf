variable "aws_region" {
  type        = string
  description = "AWS region for the ECS service."
  default     = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "justiq"
}

variable "enable" {
  type        = bool
  description = "Safety switch; leave false until foundational infrastructure is ready."
  default     = false
}

variable "cluster_name" {
  type    = string
  default = "justiq"
}

variable "api_image" {
  type        = string
  description = "Immutable API image URI, normally from GHCR."
  default     = "ghcr.io/example/justiq/api:latest"
}

variable "web_image" {
  type        = string
  description = "Immutable web image URI, normally from GHCR."
  default     = "ghcr.io/example/justiq/web:latest"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Pre-existing private subnet IDs."
  default     = []
}

variable "security_group_ids" {
  type        = list(string)
  description = "Pre-existing security groups for the ECS tasks."
  default     = []
}

variable "execution_role_arn" {
  type        = string
  description = "Pre-existing ECS task execution role ARN."
  default     = ""
}

variable "task_role_arn" {
  type        = string
  description = "Pre-existing least-privilege application task role ARN."
  default     = ""
}