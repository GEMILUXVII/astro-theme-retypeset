---
# 必填
title: 基于 Docker 在服务器上部署多个 TeamSpeak 服务器
published: 2025-07-05

# 可选
description:
updated: 2025-07-05
tags:
  - tech
  - docker
  - teamspeak

# 进阶，可选
draft: false
pin:
toc: true
lang: zh
abbrlink: teamspeak-docker-deploy
---

## 第一步：服务器环境准备 (Debian 12)

我们需要拥有一台拥有公网 ip 的云服务器，购买阿里云华为云腾讯云均可，并且安装 debian 或者 ubuntu 系统等支持 docker 的服务器系统，本文使用 Debian12 进行演示。

首先，我们需要在服务器上安装 Docker 和 Docker Compose，我们将使用国内镜像源来加速安装过程。

### 1. 更新系统并安装依赖

```bash
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl gnupg
```

### 2. 添加阿里云的 Docker GPG 密钥和软件仓库

**添加 GPG 密钥**

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

**添加软件仓库**

```bash
echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/debian \
$(lsb_release -cs) stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 3. 安装 Docker 引擎和 Docker Compose

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 4. 开放相关端口

前往云服务器安全组策略开放相关端口，如下：

9987/UDP 语音通话 (Voice)

10011/TCP 服务器查询 (ServerQuery)

30033/TCP 文件传输 (File Transfer)

以及将来在对每个端口绑定独立域名时需要的 TSDNS 服务端口 41144/TCP

## 第二步：部署你的第一个 TS 服务器

现在，让我们来部署第一个 TS 实例。

### 1. 创建项目目录

为你的第一个服务器创建一个专属文件夹，并进入该目录。

```bash
mkdir ts_server_1
cd ts_server_1
```

### 2. 创建 `docker-compose.yml` 文件

```bash
nano docker-compose.yml
```

复制粘贴如下内容到 `docker-compose.yml` 中：

```yaml
version: '3.1'
services:
  teamspeak:
    image: teamspeak
    restart: always
    ports:
      - 9987:9987/udp
      - 10011:10011
      - 30032:30032
    environment:
      TS3SERVER_DB_PLUGIN: ts3db_mariadb
      TS3SERVER_DB_SQLCREATEPATH: create_mariadb
      TS3SERVER_DB_HOST: db
      TS3SERVER_DB_USER: root
      TS3SERVER_DB_PASSWORD: example
      TS3SERVER_DB_NAME: teamspeak
      TS3SERVER_DB_WAITUNTILREADY: 30
      TS3SERVER_LICENSE: accept
      TS3SERVER_FILETRANSFER_PORT: 30032
      TS3SERVER_FILETRANSFER_IP: 0.0.0.0
    volumes:
      - ./ts3_files:/var/ts3server/
    depends_on:
      - db
  db:
    image: mariadb
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: example
      MYSQL_DATABASE: teamspeak
    volumes:
      - ./mariadb_data:/var/lib/mysql
```

其中 `ports` 部分是容器的端口映射规则，即将 9987 端口（冒号后容器内端口）映射到宿主机的 9987 端口（冒号前容器外端口 9987），我们稍后多开时将会对这部分进行修改。

**Ctrl+O** 回车保存，**Ctrl+X** 退出。

输入：

```bash
sudo docker compose up
```

复制终端输出的全部内容保存到本地，将来会用到。

**Ctrl+C** 退出。

输入：

```bash
sudo docker compose up -d
```

使其在后台运行。

现在你可以打开你的 TeamSpeak 客户端输入你的服务器公网 IP 地址尝试对容器进行链接。

现在我们就基于 Docker 部署好了第一个 TeamSpeak 服务器。接下来我们部署第二个，其仅有端口和连接方式的改变。

## 第三步：部署你的第二个 TS 服务器

同部署第一个服务器一样。

使用 `nano` 指令编写 `docker-compose.yml`，但是做一些端口的改变，如下：

```bash
version: '3.1'
services:
  teamspeak:
    image: teamspeak
    restart: always
    ports:
      - 9988:9987/udp
      - 10012:10011
      - 30033:30033
    environment:
      TS3SERVER_DB_PLUGIN: ts3db_mariadb
      TS3SERVER_DB_SQLCREATEPATH: create_mariadb
      TS3SERVER_DB_HOST: db
      TS3SERVER_DB_USER: root
      TS3SERVER_DB_PASSWORD: example
      TS3SERVER_DB_NAME: teamspeak
      TS3SERVER_DB_WAITUNTILREADY: 30
      TS3SERVER_LICENSE: accept
      TS3SERVER_FILETRANSFER_PORT: 30033
      TS3SERVER_FILETRANSFER_IP: 0.0.0.0
    volumes:
      - ./ts3_files:/var/ts3server/
    depends_on:
      - db
  db:
    image: mariadb
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: example
      MYSQL_DATABASE: teamspeak
```

对 `ports` 部分的端口进行了修改，将第二个 TeamSpeak 服务器容器内的 9987 端口映射到了宿主机的 9988 端口，并映射 10011 端口到宿主机 10012。

以及修改 `TS3SERVER_FILETRANSFER_PORT`: 为 30033 区别于第一个服务器避免冲突

同样的保存 `docker-compose.yml`，然后在前台启动容器复制关键信息，然后再后台运行容器。

此时我们将容器内的 9987 端口映射到了宿主机的 9988 端口上，所以如果我们要链接这个容器内的 TeamSpeak，需要使用服务器公网 ip+端口的地址来进行链接，比如：

`123.123.123.123:9988`

这样我们就基于 Docker 在一台 Debian 服务器上多开了 TeamSpeak 服务器。

如果你需要将不同端口的服务器分别映射到不同的域名上，参看我的另一篇文章：[单一 IP 多 TeamSpeak 服务：使用 TSDNS 和 Docker 实现各端口的独立域名访问](http://aspchang.cn/posts/tsdns)

## 个人公益 Teamspeak 服务器分享：

- **地址 1：** `ts1.kcpo.us`
- **地址 2：** `ts2.kcpo.us`

👏 完全免费，欢迎来玩！
