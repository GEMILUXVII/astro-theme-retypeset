---
title: 为多个 Docker 化 TeamSpeak 服务器部署 teamspeak-management-tools
published: 2025-07-13
updated: 2025-07-13
tags:
  - tech
  - docker
  - teamspeak
draft: false
toc: true
lang: zh
abbrlink: teamspeak-management-tools
---

在管理多个 TeamSpeak 3 服务器时，重复性的任务，如为用户创建临时私人频道，会变得相当繁琐，幸运的是，社区提供了如 `teamspeak-management-tools` 这样的开源工具，可以自动化创建临时子频道，本文将详细介绍如何在一个运行多个 Docker 化 TeamSpeak 服务器的 Linux 主机上，部署并配置此工具，实现对所有服务器的统一管理

## **一、环境与目标**

在开始之前，请确保您具备以下条件：

- **环境**: 一台运行 Docker 和 Docker Compose 的 Linux 服务器（本文以 Ubuntu 为例）
- **目标**: 您的服务器上已通过不同的 `docker-compose.yml` 文件部署了多个（例如三个）独立的 TeamSpeak 3 服务
- **工具**: teamspeak-management-tools 的预编译二进制文件

::github{repo="KunoiSayami/teamspeak-management-tools.rs"}

- **信息**:
  - 每个 TeamSpeak 服务器的 ServerQuery 管理员( `serveradmin` )密码
  - 每个服务器上用于触发自动创建子频道的“入口频道”ID

:::note
入口频道即为你要设为开启自动创建临时频道功能的频道
:::

入口频道可使用telnet连接到TeamSpeak服务器的Server Query端口进行获取，默认端口为10011/tcp

步骤如下：

1. 首先你需要有一个telnet客户端，Xshell，PuTTY都可以，此处使用的是[PuTTY](https://the.earth.li/~sgtatham/putty/latest/w64/putty-64bit-0.83-installer.msi)

2. 使用PuTTY连接到服务器Server Query端口，

![PuTTY-Config.png](https://imgbed.aspchang.cn/file/1765188053628_PuTTY-Config.png)

如图，输入你teamspeak服务器的公网ip，以及Server Query端口，选择Telnet，点击连接即可，连接成功后能看到如下字样：

```bash
TS3
Welcome to the TeamSpeak 3 ServerQuery interface, type "help" for a list of comm
ands and "help <command>" for information on a specific command.
```

3. 依次输入如下指令

```bash
login serveradmin password
use 1
channellist
```

:::note
password为对应TeamSpeak服务器第一次启动时同管理员token一并输出的密码
:::

输入完成后大致如下图：

![TSServer-Query.png](https://imgbed.aspchang.cn/file/1765188052088_TSServer-Query.png)

其中 `cid` 即为要开启自动创建临时频道功能需要的入口频道id

## **二、为 TeamSpeak 服务器配置 IP 白名单**

管理工具会以较高的频率与 TeamSpeak 服务器的 ServerQuery 端口通信 为防止被 TeamSpeak 的防洪（Anti-Flood）机制误判为攻击，我们必须将管理工具的 IP 地址加入服务器的白名单

1.  **定位 `query_ip_allowlist.txt` 文件**

    这是部署过程中的**第一个关键选择点和易错点** 您需要找到每个 TeamSpeak 容器在主机上的**真实数据目录**
    - **选择 A：使用了主机目录挂载（Bind Mount） - [推荐]**
      如果您的 `docker-compose.yml` 中包含类似以下的 `volumes` 配置：

      ```bash
      volumes:
        - ./ts-data:/var/ts3server/
      ```

      那么您的数据目录就是主机上与 `docker-compose.yml` 同级的 `ts-data` 文件夹 白名单文件路径为： `./ts-data/query_ip_allowlist.txt`

    - **选择 B：使用了匿名卷（Anonymous Volume） - [有风险]**
      如果您的 `docker-compose.yml` 中没有 `volumes` 部分，Docker 会为您创建一个匿名卷 您需要通过以下命令找到它的真实路径：

      ```bash
      # 1. 找到容器的准确名称
      $ docker-compose ps
      # 2. 使用容器名查找其数据卷的"Source"路径
      $ docker inspect [容器名] | grep '"Source":'
      ```

      输出的路径（如 `/var/lib/docker/volumes/long_id_string/_data`）就是您的数据目录

    :::warning
    【重要提示：数据安全】匿名卷存在一个巨大风险：执行 `docker-compose down` 会**永久删除**该数据卷及其中的所有数据 强烈建议您参考附录，将所有服务器都迁移到安全的“主机目录挂载”模式
    :::

2.  **编辑白名单**

    进入每个 TeamSpeak 服务器的真实数据目录，创建或编辑 `query_ip_allowlist.txt` 文件，并添加以下内容：

    ```bash
    127.0.0.1
    ::1
    172.16.0.0/12  # 覆盖Docker默认的内部网络地址范围
    ```

3.  **重启 TeamSpeak 服务**

    **这是最容易被忽略但至关重要的一步** 白名单配置必须在重启后才能生效

    ```bash
    # 进入每个TeamSpeak项目的目录
    $ cd /path/to/your/teamspeak_project
    $ docker-compose restart # 使用restart命令，安全且高效
    ```

## **三、安装与配置管理工具**

我们将采用一个管理工具实例，通过多配置文件模式来同时监控所有服务器

1.  **下载并准备工具**

    ```bash
    # 创建一个专用目录
    $ sudo mkdir -p /opt/ts-manager
    $ cd /opt/ts-manager

    # 从GitHub Releases下载适用于Linux x86_64的二进制文件
    $ sudo wget [下载链接] -O ts-manager.tar.gz
    $ sudo tar -xzvf ts-manager.tar.gz
    # 将可执行文件重命名为简短的名称
    $ sudo mv [解压出的长文件名] ts-manager
    # 赋予执行权限
    $ sudo chmod +x ts-manager
    ```

2.  **配置多服务器监控**

    我们将创建一个主配置文件( `config.toml` )和多个附加配置文件
    - **主配置文件 `config.toml` (负责第一个服务器)**

      ```bash
      # 通过绝对路径加载其他服务器的配置，这是最稳妥的方式
      additional = ["/opt/ts-manager/config_ts2.toml", "/opt/ts-manager/config_ts3.toml"]

      # --- 服务器1的配置 ---
      [server]
      server-id = 1
      channel-id = [10] # 示例：服务器1的入口频道ID
      privilege-group-id = 5
      leveldb = "ts1.db" # 为每个服务器指定独立的数据库文件

      [misc]
      interval = 5

      [raw-query]
      server = "127.0.0.1"
      port = 10012 # 示例：服务器1暴露在主机上的ServerQuery端口
      user = "serveradmin"
      password = "SERVER1_ADMIN_PASSWORD"
      ```

    - **附加配置文件 `config_ts2.toml` (负责第二个服务器)**

      ```bash # --- 服务器 2 的配置 ---
      [server]
      server-id = 1
      channel-id = [20] # 示例：服务器 2 的入口频道 ID
      privilege-group-id = 5
      leveldb = "ts2.db"

      [raw-query]
      server = "127.0.0.1"
      port = 10011 # 示例：服务器2暴露在主机上的ServerQuery端口
      user = "serveradmin"
      password = "SERVER2_ADMIN_PASSWORD"
      ```

      :::caution
      - **`additional` 路径**: 强烈建议使用**绝对路径**，避免因程序工作目录问题导致“找不到文件”的错误
      - **`leveldb` 配置**: 为每个服务器配置一个独立的数据库文件名（如`ts1.db`），可以避免潜在的数据库读写冲突
      - **密码与端口**: 请反复核对每个配置文件的`password`和`port`是否与对应的服务器完全匹配 这是导致连接失败最常见的原因
        :::

## **四、通过 Systemd 实现后台运行**

将工具作为 `systemd` 服务运行，可以确保其稳定性和开机自启

1.  **创建服务文件**

    ```bash
    $ sudo nano /etc/systemd/system/ts-manager.service
    ```

    将以下内容粘贴进去：

    ```bash
    [Unit]
    Description=TeamSpeak AutoChannel Management Tool
    After=network.target docker.service
    Requires=docker.service

    [Service]
    Type=simple
    User=root
    # 明确指定工作目录和可执行文件的绝对路径
    WorkingDirectory=/opt/ts-manager
    ExecStart=/opt/ts-manager/ts-manager
    Restart=on-failure
    RestartSec=10

    [Install]
    WantedBy=multi-user.target
    ```

2.  **启动并验证服务**

    ```bash
    # 重新加载systemd配置
    $ sudo systemctl daemon-reload
    # 启动服务
    $ sudo systemctl start ts-manager.service
    # 设置开机自启
    $ sudo systemctl enable ts-manager.service
    # 检查服务状态
    $ sudo systemctl status ts-manager.service
    ```

    如果服务状态显示 `active (running)`，恭喜您，部署成功！

## **五、故障排查**

如果在启动服务时遇到问题（例如状态为 `activating (auto-restart)` ），请遵循以下步骤：

1.  **停止服务**： `sudo systemctl stop ts-manager.service` ，防止其无效重启

2.  **查看详细日志**： `sudo journalctl -u ts-manager.service -e --no-pager` ，找到具体的错误信息

3.  **在前台手动运行**： `cd /opt/ts-manager && sudo ./ts-manager` ，这会直接在屏幕上打印出最清晰的错误
    - `Error: No such file or directory` : 通常是 `additional` 路径错误，或`leveldb`配置问题 请使用绝对路径并为每个服务指定 DB 文件

    - `Error: invalid loginname or password` : 密码或用户名错误 请重新核对

    - `Error: connection failed, flood ban` : 对应服务器的白名单未生效 请检查白名单文件内容并**重启**该 TeamSpeak 服务

4.  **解决问题后**，再重新启动 `systemd` 服务

---

### **附录：将 TeamSpeak 数据迁移到安全的主机目录挂载**

如果您还在使用匿名卷，强烈建议进行以下一次性迁移操作，以保障数据安全

**以迁移一个服务器为例：**

1.  **完整备份**： `sudo docker cp [容器名]:/var/ts3server/ /path/to/temp_backup/`

2.  **停止并删除旧容器**： `cd /path/to/project && sudo docker-compose down`

3.  **创建本地数据目录**： `mkdir ./ts-data`

4.  **修改 docker-compose.yml**：在 `teamspeak` 服务下添加 `volumes: - ./ts-data:/var/ts3server/`

5.  **恢复数据**： `sudo cp -a /path/to/temp_backup/ts3server/. ./ts-data/`

6.  **重新启动服务**： `sudo docker-compose up -d`

完成此操作后，您的所有服务器数据都将安全地存放在主机上，易于管理和备份
