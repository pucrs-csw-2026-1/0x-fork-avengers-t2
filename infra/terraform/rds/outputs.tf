output "db_host" {
  description = "Host do endpoint RDS (via Ministack LocalStack)"
  value       = aws_db_instance.events.address
}

output "db_port" {
  description = "Porta do Postgres"
  value       = aws_db_instance.events.port
}

output "database_url" {
  description = "Connection string no formato que src/db/index.ts e drizzle.config.ts já esperam"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.events.address}:${aws_db_instance.events.port}/${var.db_name}"
  sensitive   = true
}
