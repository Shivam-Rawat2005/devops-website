locals {
  site_host = var.enable_lb ? aws_lb.web[0].dns_name : aws_eip.web[0].public_ip
  site_url  = "${local.https ? "https" : "http"}://${local.site_host}"
}

output "site_url" {
  description = "Address of the website. With a domain, point its DNS here."
  value       = local.site_url
}

output "web_public_ips" {
  description = "Elastic IP of each web server (used for SSH by Ansible)."
  value       = aws_eip.web[*].public_ip
}

output "load_balancer_dns" {
  description = "DNS name of the load balancer, if enabled."
  value       = var.enable_lb ? aws_lb.web[0].dns_name : null
}

# The Ansible inventory, written by the pipeline with:
#   terraform output -raw ansible_inventory > ../ansible/inventories/<env>/hosts.yml
output "ansible_inventory" {
  description = "Ansible inventory (YAML) listing the web servers."
  value = templatefile("${path.module}/inventory.yml.tftpl", {
    environment      = var.environment
    aws_region       = var.aws_region
    target_group_arn = var.enable_lb ? aws_lb_target_group.web[0].arn : ""
    site_url         = local.site_url
    servers = [
      for i, instance in aws_instance.web : {
        name        = "web-${i + 1}"
        ip          = aws_eip.web[i].public_ip
        instance_id = instance.id
      }
    ]
  })
}
