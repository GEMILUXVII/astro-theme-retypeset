---
title: 在 Debian12 服务器上部署 Astrbot 与 Overflow (NapCat 双后端)
published: 2025-09-15
updated: 2025-09-15
tags:
  - tech
  - server
  - bot
draft: false
toc: true
lang: zh
abbrlink: astrbot-overflow-napcat
---

##

本指南旨在提供一个清晰、高效的流程，在 Debian 12 服务器上部署一套 QQ 机器人架构，其中 **Napcat** 作为核心协议端，同时为 **Astrbot** 和 **Overflow** 两个独立的应用后端提供支持

## **前置准备**

1.  一台 Debian 12 服务器（位于国内）
2.  一个 QQ 账号

## **第一步：部署 Napcat**

[Napcat](https://napneko.github.io/) 是连接 QQ 网络的协议端，它将作为事件中心，将消息和事件分发给后端的 Astrbot 和 Overflow

::github{repo="NapNeko/NapCatQQ"}

1.  **创建工作目录与 `compose.yml`**

    ```bash
    mkdir -p ~/napcat && cd ~/napcat
    nano compose.yml
    ```

2.  **粘贴以下 Docker Compose 配置**

    ```bash
    version: '3.8'
    services:
      napcat:
        image: mlikiowa/napcat-docker:latest
        container_name: napcat
        restart: always
        network_mode: 'host'
        volumes:
          - ./napcat-data:/app/data
    ```

3.  **启动并扫码登录**
    - 前台启动获取二维码

    ```bash
    sudo docker compose up
    ```

    - 扫描日志中的二维码或链接，使用手机 QQ 确认登录
    - 复制终端中 Napcat WebUI 链接到浏览器打开，进行后续配置
    - 点击左侧 `其它配置` -> `登录配置` -> 填入快速登录 QQ 账号
    - 登录成功后，按 Ctrl+C 停止容器
    - 后台启动服务

    ```bash
    sudo docker compose up -d
    ```

    请务必记下终端输出中 WebUI 的访问地址和 Token，后续配置连接时需要用到

## **第二步：部署应用后端 1 (Astrbot)**

[Astrbot](https://astrbot.app/) 是我们的第一个应用后端，使用 Docker Compose 进行部署

::github{repo="AstrBotDevs/AstrBot"}

1.  **创建工作目录与克隆 Astrbot 仓库**

    ```bash
    mkdir -p ~/astrbot && cd ~/astrbot
    git clone https://github.com/AstrBotDevs/AstrBot.git .
    # 克隆到当前目录
    ```

2.  **编辑 `compose.yml` 文件**

    根据是否在第一步中配置了代理，对 Astrbot 的 `compose.yml` 文件进行相应修改

    ```bash
    version: '3.8'
    services:
      astrbot:
        image: soulter/astrbot:latest
        container_name: astrbot
        restart: always
        # [核心修改1] 添加 network_mode: "host" 以共享主机网络
        # 这样容器就能直接访问 v2rayA 的代理端口，并且方便与 Napcat 通信
        network_mode: 'host'

        environment:
          - TZ=Asia/Shanghai
          # [核心修改2 - 可选] 如果配置了 v2rayA，请添加以下代理环境变量
          - HTTP_PROXY=socks5://127.0.0.1:20170
          - HTTPS_PROXY=socks5://127.0.0.1:20170

        volumes:
          - ./data:/AstrBot/data
          - /etc/localtime:/etc/localtime:ro
    ```

3.  **启动 Astrbot**

    ```bash
    sudo docker compose up -d
    ```

    Astrbot WebUI 现已运行在 `http://<服务器IP>:6185` 上

## **第三步：部署应用后端 2 (Overflow)**

[Overflow](https://mirai.mrxiaom.top/) 是我们的第二个应用后端，基于 Mirai 生态，我们使用 Systemd 来管理其服务

::github{repo="MrXiaoM/Overflow"}

1.  **准备环境**
    使用 SFTP 等工具上传 `overflow.zip` 到服务器的 `~/overflow` 目录并解压

    ```bash
    mkdir -p ~/overflow && cd ~/overflow
    sudo apt install unzip openjdk-17-jre -y
    unzip overflow.zip
    ```

2.  **创建 Systemd 服务**

    执行

    ```bash
    sudo nano /etc/systemd/system/overflow.service
    ```

    并粘贴以下内容：

    ```bash
    [Unit]
    Description=Overflow QQ Bot Service
    After=network.target

    [Service]
    Type=simple
    User=root
    WorkingDirectory=/root/overflow
    ExecStart=/bin/bash /root/overflow/start.sh
    Restart=on-failure
    RestartSec=10s

    [Install]
    WantedBy=multi-user.target
    ```

3.  **启动服务**
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl start overflow
    sudo systemctl enable overflow
    ```

## **第四步：建立连接 (Napcat -> Astrbot & Overflow)**

我们采用两种不同的 WebSocket 模式来连接两个后端：

- **Astrbot (反向 WS)**：Astrbot 作为服务端，Napcat 作为客户端连接它
- **Overflow (正向 WS)**：Napcat 作为服务端，Overflow 作为客户端连接它

### **4.1 连接 Astrbot (反向模式)**

1.  **配置 Astrbot (服务端)**
    - 访问 Astrbot WebUI (`http://<服务器IP>:6185`)
    - 进入 **消息平台** -> `+ 新增适配器` -> 选择 `aiocqhttp(OneBotv11)`
    - **配置项：**
      - **ID(id)**：`astrbot-reverse-server` (或自定义)
      - **启用(enable)**: 勾选
      - **反向 WebSocket 主机地址**：`0.0.0.0`
      - **反向 WebSocket 端口**：`6199` (确保此端口未被占用)
    - 点击 `保存`
    - 进入 `配置` -> `其他配置`，在 `管理员 ID` 中填写你的 QQ 号，保存

2.  **配置 Napcat (客户端)**
    - 进入 Napcat WebUI
    - 点击 `网络配置` -> `新建` -> `Websockets客户端`
    - **配置项：**
      - 勾选 `启用`
      - **URL**: `ws://127.0.0.1:6199/ws`
      - 点击 `保存`

### **4.2 连接 Overflow (正向模式)**

1.  **配置 Napcat (服务端)**
    - 进入 Napcat WebUI
    - 点击 `网络配置` -> `新建` -> `Websocket服务器`
    - **配置项：**
      - 勾选 `启用`
      - **主机**: `127.0.0.1`
      - **端口**: `3001` (确保此端口未被占用)
      - 点击 `保存`

      输入一个足够复杂的 Token，如 `mirai_overflow108`

    > Overflow 强制要求 Token 足够复杂以保证安全，否则无法启动

2.  **配置 Overflow (客户端)**
    - 确保 Overflow 已启动过一次且成功生成了配置文件 `overflow.json`
    - 进入 Overflow 的配置文件 (通常在 Overflow 根目录下)，找到 `ws_host` 的相关设置
    - 修改/新增一个**正向 WebSocket 客户端**配置，指向 Napcat 监听的地址：

    ```bash
    "ws_host": "ws://127.0.0.1:3001",
    ```

    - 填写之前在 Napcat 配置的 Token，配置完成后的 `overflow.json` 文件大致如下所示：

    ```bash
    {
      no_log___DO_NOT_REPORT_IF_YOU_SWITCH_THIS_ON___开启此选项时不接受漏洞反馈: false,
      ws_host: 'ws://127.0.0.1:3001',
      reversed_ws_port: -1,
      token: 'mirai_overflow108',
      no_platform: false,
      use_cq_code: false,
      retry_times: 5,
      retry_wait_mills: 5000,
      retry_rest_mills: 60000,
      heartbeat_check_seconds: 60,
      use_group_upload_event_for_file_message: false,
      resource_cache: {
        enabled: false,
        keep_duration_hours: 168,
      },
      drop_events_before_connected: true,
    }
    ```

    - 保存配置并重启 Overflow 服务 ( `sudo systemctl restart overflow` )

### **4.3 验证连接**

- 在 Astrbot WebUI 的 `控制台`，应出现 `aiocqhttp(OneBot v11) 适配器已连接` 的日志
- 通过 `sudo journalctl -u overflow -f` 查看 Overflow 日志，应能看到成功连接到 `ws://127.0.0.1:3001` 的日志

至此，您已成功搭建了 Napcat 同时为 Astrbot 和 Overflow 两个后端服务的 QQ 机器人

---

## **附录**

1. Mirai 权限问题处理

当使用 Overflow/Mirai 时，如果终端提示权限不足，这是 Mirai 的安全机制所致

- **错误示例**: `权限不足. /bili 需要权限 top.colter.bili-dynamic-mirai-plugin:command.bili`

- **解决方法**: 在 Overflow 的控制台中，使用 `/perm` 指令进行授权，语法为 `被授权对象` 在前

  ```bash
  # 示例：允许所有用户执行任意 Console 内置指令
  /perm permit u* console:*
  ```

2. 配置代理环境 (v2rayA/可选)

此步骤为可选操作，主要为 Astrbot 访问外部服务提供网络支持，如果您不需要访问如 Google API 等服务，可以跳过此步

- **安装 v2rayA**

  ```bash
  # 添加 GPG 公钥与软件源
  wget -qO - https://apt.v2raya.org/key/public-key.asc | sudo tee /etc/apt/keyrings/v2raya.asc
  echo "deb [signed-by=/etc/apt/keyrings/v2raya.asc] https://apt.v2raya.org/ v2raya main" | sudo tee /etc/apt/sources.list.d/v2raya.list

  # 安装
  sudo apt update && sudo apt install v2raya xray -y
  ```

- **启动并配置**

  ```bash
  sudo systemctl start v2raya
  sudo systemctl enable v2raya
  ```

- 访问 `http://<服务器IP>:2017`，创建管理员
- 导入您的订阅链接，选择一个节点并启动
- 在 **设置 -> 地址与端口** 中，确认 **SOCKS5 端口**为 `20170`
