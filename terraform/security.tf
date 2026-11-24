# Security groups are AWS firewalls.
# Web servers: SSH for Ansible, plus HTTP/HTTPS. With a load balancer, web traffic
# is only accepted from the load balancer; without one, from anywhere.

resource "aws_security_group" "web" {
  name        = "${local.name}-web"
  description = "Web servers: SSH for Ansible, HTTP and HTTPS"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-web" }
}

resource "aws_vpc_security_group_ingress_rule" "web_ssh" {
  for_each = toset(var.ssh_cidrs)

  security_group_id = aws_security_group.web.id
  description       = "SSH (key-only login)"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_ingress_rule" "web_http_public" {
  for_each = var.enable_lb ? toset([]) : toset(["80", "443"])

  security_group_id = aws_security_group.web.id
  description       = "Public web traffic (no load balancer)"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "web_http_from_lb" {
  count = var.enable_lb ? 1 : 0

  security_group_id            = aws_security_group.web.id
  description                  = "HTTP from the load balancer only"
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.lb[0].id
}

resource "aws_vpc_security_group_egress_rule" "web_all" {
  security_group_id = aws_security_group.web.id
  description       = "Outbound: package updates and Docker image pulls"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_security_group" "lb" {
  count = var.enable_lb ? 1 : 0

  name        = "${local.name}-lb"
  description = "Load balancer: public HTTP and HTTPS"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-lb" }
}

resource "aws_vpc_security_group_ingress_rule" "lb_web" {
  for_each = var.enable_lb ? toset(["80", "443"]) : toset([])

  security_group_id = aws_security_group.lb[0].id
  description       = "Public web traffic"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "lb_to_web" {
  count = var.enable_lb ? 1 : 0

  security_group_id            = aws_security_group.lb[0].id
  description                  = "Forward requests to the web servers"
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.web.id
}
