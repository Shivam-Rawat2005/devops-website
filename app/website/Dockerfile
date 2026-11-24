# Website image: Nginx serving the static site and proxying /api/ to the API container.
FROM nginx:1.27-alpine

# Replace the default site with ours.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/site.conf
COPY index.html 404.html style.css app.js theme-init.js favicon.svg deployments.json /usr/share/nginx/html/
COPY fonts /usr/share/nginx/html/fonts

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/healthz"]
