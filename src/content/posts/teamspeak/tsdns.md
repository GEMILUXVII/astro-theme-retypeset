---
title: 单一 IP 多 TeamSpeak 服务：使用 TSDNS 和 Docker 实现各端口的独立域名访问
published: 2025-07-07
updated: 2025-07-07
tags:
  - tech
  - docker
  - teamspeak
toc: true
lang: zh
abbrlink: tsdns
---

## 摘要

本文详述了为 TeamSpeak 3 (TS3) 服务器部署 TSDNS（TeamSpeak DNS）服务的完整流程：通过在 Docker 容器中运行 TSDNS 实例，管理员可以获得一个集中化、高灵活性的域名解析层，从而为多个游戏服务器或社群提供不同而又简洁、免端口的连接地址

### 1\. 前置条件

- **主机环境:** 拥有公网 IPv4 地址的 Linux 服务器
- **域名:** 一个可由您管理的有效域名
- **软件依赖:** 服务器已安装 Docker Engine
- **基础知识:** 掌握基本的 Linux Shell 操作及 Docker 命令

### 2\. 架构规划与解析流程

在部署之前，必须明确整个解析流程 当 TeamSpeak 客户端尝试连接一个域名时，其解析顺序如下：

1.  **TSDNS SRV 查询:** 客户端首先查询 `_tsdns._tcp.example.com` 的 SRV 记录
2.  **TSDNS 服务连接:** 如果 SRV 记录存在，客户端会连接到记录指向的 TSDNS 服务器（在我们的架构中，即 `ts-dns` Docker 容器的 `41144` 端口）
3.  **应用层解析:** 客户端向 TSDNS 服务发送其尝试连接的原始域名（例如 `game1.example.com`）
4.  **配置文件匹配:** TSDNS 服务在 `tsdns_settings.ini` 文件中查找匹配的规则，并返回对应的 `IP:端口`
5.  **语音服务连接:** 客户端使用从 TSDNS 获取的最终地址，向目标 TeamSpeak 语音服务器发起连接

本教程将基于以下示例参数进行部署：

- **服务器公网 IP:** `123.123.123.123`
- **主域名:** `example.com`
- **目标映射:**
  - `game1.example.com` → `123.123.123.123:9986`
  - 所有其他 `*.example.com` → `123.123.123.123:9987` (回退/默认)

### 3\. TSDNS 服务部署

此步骤将创建一个独立的 Docker 容器来运行 TSDNS 服务

#### 3.1 配置文件 (`tsdns_settings.ini`)

此文件是 TSDNS 服务的核心，定义了域名到地址的映射规则

1.  在主机上创建并编辑配置文件：

    ```bash
    mkdir -p /opt/tsdns_config
    nano /opt/tsdns_config/tsdns_settings.ini
    ```

2.  填入以下映射规则：

    ```ini
    # 为特定子域名 game1.example.com 指定 IP 和非标准端口 9986
    game1.example.com=123.123.123.123:9986

    # [最佳实践] 使用通配符为所有其他未明确定义的子域名提供一个回退地址
    *.example.com=123.123.123.123:9987
    ```

<NoticeBox type="warning" title="注意">
此文件中的 IP 地址必须为服务器的公网 IP，以确保外部客户端可以访问 键值对格式为 `域名=IP:端口`，不支持额外的空格或注释
</NoticeBox>

#### 3.2 Docker 容器化部署

使用以下命令创建并启动 TSDNS 服务容器：

```bash
docker run -d \
  --name tsdns-server \
  --restart unless-stopped \
  -p 41144:41144/tcp \
  -v /opt/tsdns_config/tsdns_settings.ini:/data/tsdns_settings.ini:ro \
  -w /data \
  teamspeak:latest \
  /opt/ts3server/tsdns/tsdnsserver
```

<CodeExplanation>
**`--restart unless-stopped`**: 确保 Docker 服务重启或容器意外退出时，服务能自动恢复，保障高可用性

**`-p 41144:41144/tcp`**: 映射 TSDNS 服务的标准 TCP 端口

**`-v ...:ro`**: 以只读模式（`ro`）挂载主机上的配置文件 这是安全最佳实践，可防止容器意外修改主机文件

**`-w /data`**: 将容器的工作目录（Working Directory）设置为 `/data` 此举旨在匹配配置文件的挂载点，以满足 `tsdnsserver` 程序在当前工作目录查找 `tsdns_settings.ini` 的隐性依赖

**`/opt/ts3server/tsdns/tsdnsserver`**: 使用绝对路径执行程序，确保不受容器 `PATH` 环境变量的影响，是保证命令执行成功率的稳健做法
</CodeExplanation>

#### 3.3 服务状态验证

部署后，使用 `docker ps` 命令检查容器状态 `STATUS` 列应显示为 `Up ...` 如果状态为 `Restarting`，应立即使用 `docker logs tsdns-server` 检查日志以诊断问题

### 4\. 公共 DNS 配置

最后一步是配置公共 DNS 记录，以引导客户端发现您的 TSDNS 服务

1.  **A 记录 (地址记录)**
    此记录用于将目标域名解析至服务器 IP
    - **主机:** `@`
    - **类型:** `A`
    - **值:** `123.123.123.123`

2.  **SRV 记录 (服务定位记录)**
    此记录遵循 RFC 2782 标准，用于 TSDNS 服务的自动发现
    - **服务 (Service):** `_tsdns`
    - **协议 (Protocol):** `_tcp`
    - **优先级 (Priority):** `0`
    - **权重 (Weight):** `5`
    - **端口 (Port):** `41144`
    - **目标 (Target):** `example.com`

## 5\. 总结

通过上述部署，已成功构建一个独立于标准语音 SRV 解析的、动态的 TSDNS 解析服务 该架构提供了高度的灵活性和集中化的域名管理能力，使管理员能够轻松应对复杂的多服务器、多端口映射需求

完成 DNS 配置后，请等待 DNS 记录在全球范围内完成传播（通常需要几分钟到数小时不等），即可开始使用您自定义的域名进行连接
