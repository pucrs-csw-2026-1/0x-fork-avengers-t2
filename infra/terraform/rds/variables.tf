variable "aws_region" {
  description = "Região AWS usada pelo provider (dummy quando apontando para a Ministack LocalStack)"
  type        = string
  default     = "us-east-1"
}

variable "localstack_endpoint" {
  description = "Endpoint da Ministack LocalStack Pro compartilhada com o 0x_t2"
  type        = string
  default     = "http://localhost:4566"
}

variable "db_name" {
  description = "Nome do banco de dados (reconciliado com o valor real de .env.example, não 'events')"
  type        = string
  default     = "events_db"
}

variable "db_username" {
  description = "Usuário do Postgres"
  type        = string
  default     = "events_user"
}

variable "db_password" {
  description = "Senha do Postgres — sem default, deve ser fornecida via terraform.tfvars (gitignored) ou TF_VAR_db_password"
  type        = string
  sensitive   = true
}

variable "db_port" {
  description = "Porta do Postgres"
  type        = number
  default     = 5432
}

variable "db_instance_class" {
  description = "Classe da instância RDS"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Armazenamento alocado (GB)"
  type        = number
  default     = 20
}
