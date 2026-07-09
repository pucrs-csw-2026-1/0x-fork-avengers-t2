provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    rds = var.localstack_endpoint
  }
}

resource "aws_db_instance" "events" {
  identifier        = "eventmgmt-events-db"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  publicly_accessible = true
  skip_final_snapshot = true

  lifecycle {
    # A Ministack (LocalStack) popula `max_allocated_storage` na instancia, o que
    # gera um diff perpetuo (20 -> null) e faz o `terraform apply` de reconciliacao
    # travar num ModifyDBInstance que o emulador nao completa. Ignorar mantem o
    # `docker compose up` idempotente (re-apply vira no-op) sem afetar o create.
    ignore_changes = [max_allocated_storage]
  }
}
