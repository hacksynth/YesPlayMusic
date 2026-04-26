# YesPlayMusic

这是 `hacksynth/YesPlayMusic` fork，基于 YesPlayMusic 0.4.10 维护，主要用于自用构建、Docker 部署和 GitHub Actions 自动发布。

YesPlayMusic 是一个第三方网易云音乐播放器，支持网页登录、Electron 桌面端、PWA、MV、歌词、私人 FM、每日推荐、Last.fm Scrobble，并可配合 UnblockNeteaseMusic 使用。

## 仓库地址

- GitHub: <https://github.com/hacksynth/YesPlayMusic>
- Docker 镜像: `ghcr.io/hacksynth/yesplaymusic:latest`
- Release: <https://github.com/hacksynth/YesPlayMusic/releases>

## 当前维护内容

- 使用 GitHub Actions 构建 Electron 客户端。
- 使用 GitHub Actions 构建并推送 Docker 镜像到 GHCR。
- Docker 运行时使用 Node 22，避免 API 依赖在 Node 14 下启动失败。
- Docker 内置 `@neteasecloudmusicapienhanced/api@4.32.0`，启动时不再通过 `npx` 临时拉取最新版 API。
- Web 构建兼容浏览器环境，避免 `process is not defined` 导致页面空白。

## Docker 部署

推荐直接使用 GHCR 镜像：

```yaml
services:
  YesPlayMusic:
    image: ghcr.io/hacksynth/yesplaymusic:latest
    pull_policy: always
    container_name: YesPlayMusic
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /etc/timezone:/etc/timezone:ro
      - ./docker/nginx.conf.example:/etc/nginx/http.d/default.conf:ro
    ports:
      - 80:80
    restart: always
    depends_on:
      - UnblockNeteaseMusic
    environment:
      - NODE_TLS_REJECT_UNAUTHORIZED=0
    networks:
      my_network:

  UnblockNeteaseMusic:
    image: pan93412/unblock-netease-music-enhanced
    command: -o kugou kuwo migu bilibili pyncmd -p 80:443 -f 45.127.129.53 -e -
    networks:
      my_network:
        aliases:
          - music.163.com
          - interface.music.163.com
          - interface3.music.163.com
          - interface.music.163.com.163jiasu.com
          - interface3.music.163.com.163jiasu.com
    restart: always

networks:
  my_network:
    driver: bridge
```

启动：

```sh
docker compose pull
docker compose up -d
docker compose logs -f --tail=100
```

如果宿主机 80 端口已被占用，可以改成其他端口，例如：

```yaml
ports:
  - 3001:80
```

访问地址对应为 `http://服务器IP:3001`。

## 本地构建 Docker 镜像

```sh
docker build -t yesplaymusic .
docker run -d --name YesPlayMusic -p 80:80 yesplaymusic
```

本地镜像也会同时运行前端 nginx 和网易云 API 服务。前端通过 `/api` 代理到容器内的 API。

## 开发

需要 Node.js 20.19 或更高版本，推荐 Node.js 22。

```sh
npm install
cp .env.example .env
npm run serve
```

本地运行 API：

```sh
npm run netease_api:run
```

构建 Web：

```sh
npm run build
```

构建 Electron：

```sh
npm run electron:build
```

运行测试：

```sh
npm test
```

## GitHub Actions

本仓库包含两个主要工作流：

- `Release`: push 到 `master` 时构建并上传 macOS、Windows、Linux artifacts；push `v*` tag 时发布到 GitHub Release。
- `Docker`: push 到 `master` 或 `v*` tag 时构建 Docker 镜像并推送到 GHCR。

创建新 release 的基本流程：

```sh
git tag v0.4.10
git push origin v0.4.10
```

tag workflow 成功后，Release 页面会生成对应平台资产。

## 服务器部署

部署时进入保存 `docker-compose.yml` 的目录，拉取最新镜像并重启服务。

如果宿主机 80 端口已被占用，可以将端口映射改为 `3001:80` 或其他可用端口。访问地址取决于实际服务器 IP、域名和端口。

更新部署：

```sh
docker compose pull YesPlayMusic
docker compose up -d YesPlayMusic
docker compose logs -f --tail=100 YesPlayMusic
```

## 常见问题

### 页面空白

先强制刷新浏览器缓存：

```text
Ctrl + F5
```

如果仍然空白，打开浏览器开发者工具查看 Console。之前遇到过的原因是构建产物中残留 `process.platform`，浏览器报错 `process is not defined`。当前版本已在 Vite 构建中定义 `process.platform`。

### API 启动失败，提示 Object.hasOwn is not a function

这是 Node 版本过低导致的。旧 Docker 运行时基于 `nginx:1.20.2-alpine`，通过 Alpine 包安装到的是 Node 14，而新版 API 依赖需要 Node 18/20+。

当前 Dockerfile 已改为 Node 22 运行时，并固定 API 版本：

```text
@neteasecloudmusicapienhanced/api@4.32.0
```

### GHCR 镜像无法拉取

如果服务器无法拉取 `ghcr.io/hacksynth/yesplaymusic:latest`，检查 GHCR package 是否公开。私有 package 需要先登录：

```sh
docker login ghcr.io
```

### nginx 配置挂载路径

当前运行时镜像使用 Alpine 的 nginx 包，配置路径是：

```text
/etc/nginx/http.d/default.conf
```

不要挂载到旧路径 `/etc/nginx/conf.d/default.conf`，否则自定义 nginx 配置不会生效。

## 上游项目

- YesPlayMusic: <https://github.com/qier222/YesPlayMusic>
- api-enhanced: <https://github.com/neteasecloudmusicapienhanced/api-enhanced>
- UnblockNeteaseMusic: <https://github.com/UnblockNeteaseMusic/server>

## 许可

本项目基于 MIT License。仅供个人学习研究使用，请勿用于商业或非法用途。
