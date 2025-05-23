FROM node:18.19.1

WORKDIR /app

COPY package*.json ./
RUN npm install

# Instalar bash
RUN apt-get update && apt-get install -y bash

COPY . .
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENTRYPOINT ["/bin/bash", "./entrypoint.sh"] 