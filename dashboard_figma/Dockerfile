# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app
COPY dashboard_figma/package.json dashboard_figma/package-lock.json ./
RUN npm ci
COPY dashboard_figma/ ./

# VITE_API_BASE_URL é embutida no bundle em build-time (o código roda no
# navegador do usuário, não na rede interna do compose) — por isso o default
# aponta pro backend publicado em localhost, não pro nome do serviço "backend".
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY dashboard_figma/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
