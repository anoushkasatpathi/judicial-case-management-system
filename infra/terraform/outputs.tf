output "cluster_name" {
  value = try(aws_ecs_cluster.this[0].name, null)
}

output "api_service_name" {
  value = try(aws_ecs_service.api[0].name, null)
}

output "web_service_name" {
  value = try(aws_ecs_service.web[0].name, null)
}