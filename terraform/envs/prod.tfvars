# Prod: two servers in two availability zones behind a load balancer,
# so Ansible can update one while the other keeps serving visitors.
# The load balancer and second server are NOT free: destroy prod after your demo.
environment   = "prod"
instance_type = "t3.micro"
web_count     = 2
enable_lb     = true
vpc_cidr      = "10.30.0.0/16"

# For HTTPS, create a certificate in AWS Certificate Manager for your domain and paste its ARN:
# certificate_arn = "arn:aws:acm:ap-south-1:123456789012:certificate/..."
