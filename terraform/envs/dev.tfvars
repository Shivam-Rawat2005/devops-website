# Dev: one small server, no load balancer. Cheapest setup; can fit the AWS free tier.
environment   = "dev"
instance_type = "t3.micro"
web_count     = 1
enable_lb     = false
vpc_cidr      = "10.20.0.0/16"
