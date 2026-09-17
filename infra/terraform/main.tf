locals {
  enabled = var.enable && length(var.private_subnet_ids) > 0 && length(var.security_group_ids) > 0 && var.execution_role_arn != "" && var.task_role_arn != ""
  tags    = { Project = var.project_name, ManagedBy = "terraform" }
}

resource "aws_ecs_cluster" "this" {
  count = var.enable ? 1 : 0
  name  = var.cluster_name
  tags  = local.tags
}

resource "aws_cloudwatch_log_group" "api" {
  count             = local.enabled ? 1 : 0
  name              = "/ecs/${var.project_name}/api"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "web" {
  count             = local.enabled ? 1 : 0
  name              = "/ecs/${var.project_name}/web"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_ecs_task_definition" "api" {
  count                    = local.enabled ? 1 : 0
  family                   = "${var.project_name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn      = var.execution_role_arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([{ name = "api", image = var.api_image, essential = true, portMappings = [{ containerPort = 3000, protocol = "tcp" }], logConfiguration = { logDriver = "awslogs", options = { "awslogs-group" = aws_cloudwatch_log_group.api[0].name, "awslogs-region" = var.aws_region, "awslogs-stream-prefix" = "api" } } }])
  tags = local.tags
}

resource "aws_ecs_task_definition" "web" {
  count                    = local.enabled ? 1 : 0
  family                   = "${var.project_name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn      = var.execution_role_arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([{ name = "web", image = var.web_image, essential = true, portMappings = [{ containerPort = 80, protocol = "tcp" }], logConfiguration = { logDriver = "awslogs", options = { "awslogs-group" = aws_cloudwatch_log_group.web[0].name, "awslogs-region" = var.aws_region, "awslogs-stream-prefix" = "web" } } }])
  tags = local.tags
}

resource "aws_ecs_service" "api" {
  count           = local.enabled ? 1 : 0
  name            = "${var.project_name}-api"
  cluster         = aws_ecs_cluster.this[0].id
  task_definition = aws_ecs_task_definition.api[0].arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }
  tags = local.tags
}

resource "aws_ecs_service" "web" {
  count           = local.enabled ? 1 : 0
  name            = "${var.project_name}-web"
  cluster         = aws_ecs_cluster.this[0].id
  task_definition = aws_ecs_task_definition.web[0].arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }
  tags = local.tags
}