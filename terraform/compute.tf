# The web servers: Ubuntu 24.04 EC2 instances, spread across the two subnets,
# each with an Elastic IP so its address never changes (Ansible connects to it).

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical, the publisher of Ubuntu

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "deploy" {
  key_name   = "${local.name}-deploy"
  public_key = var.ssh_public_key
}

resource "aws_instance" "web" {
  count = var.web_count

  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[count.index % length(aws_subnet.public)].id
  vpc_security_group_ids = [aws_security_group.web.id]
  key_name               = aws_key_pair.deploy.key_name

  # Require IMDSv2, the more secure version of the instance metadata service.
  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  tags = { Name = "${local.name}-web-${count.index + 1}" }

  lifecycle {
    # A newer Ubuntu image should not replace running servers on every apply.
    ignore_changes = [ami]
  }
}

resource "aws_eip" "web" {
  count = var.web_count

  domain   = "vpc"
  instance = aws_instance.web[count.index].id

  tags = { Name = "${local.name}-web-${count.index + 1}" }

  depends_on = [aws_internet_gateway.main]
}
