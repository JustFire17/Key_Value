FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Instalar bash
RUN apk add --no-cache bash

COPY . .
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "./entrypoint.sh"] 