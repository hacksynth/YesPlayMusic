FROM node:22-alpine AS build
ENV VUE_APP_NETEASE_API_URL=/api
WORKDIR /app
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories &&\
	apk add --no-cache python3 make g++ git
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci
COPY . .
RUN npm run build

FROM nginx:1.20.2-alpine AS app

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories \
  && apk add --no-cache libuv nodejs npm \
  && npm config set registry https://registry.npmmirror.com \
  && npm i -g @neteasecloudmusicapienhanced/api@4.32.0

COPY --from=build /app/docker/nginx.conf.example /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

CMD ["sh", "-c", "nginx && exec npx @neteasecloudmusicapienhanced/api"]
