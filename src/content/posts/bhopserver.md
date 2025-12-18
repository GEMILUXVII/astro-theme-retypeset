---
title: CS:S BHop 服务器部署
published: 2025-06-14
tags:
  - tech
  - server
  - css
draft: false
toc: true
lang: zh
abbrlink: bhopserver
---

## 摘要

本文档旨在为 Counter-Strike: Source (CS:S) Bunny Hop (BHop) 专用服务器的搭建提供一套完整、标准化的操作流程

## 第一步：环境准备与 SteamCMD 初始化

SteamCMD 是 Valve 提供的用于部署和维护专用服务器的命令行工具，是此流程的先决条件

1.  **目录创建**：建立一个清晰的目录结构，建议在非系统盘创建主目录，例如 `D:\SRCDS`
2.  **SteamCMD 获取**：
    - 在主目录下创建 `steamcmd` 子目录 (`~\steamcmd`)
    - 从 Valve 官方服务器 [下载 SteamCMD](https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip)
    - 将 `steamcmd.exe` 解压缩至上述 `steamcmd` 目录中

3.  **初始化**：执行 `steamcmd.exe`：程序将自动完成更新与初始化，操作完成后，将进入 `Steam>` 命令行交互界面

## 第二步：CS:S 专用服务器文件下载

必须严格遵循指令顺序，以确保文件被部署到正确的指定位置

1.  启动 `steamcmd.exe`
2.  在 `Steam>` 提示符后，依次执行以下指令：

```bash
// 设定服务器文件的安装目录，此路径是相对于 steamcmd.exe 的相对路径
force_install_dir ../css_server/

// 使用匿名账户登录 Steam 公共服务器
login anonymous

// 下载并校验 CS:S 专用服务器文件 (App ID: 232330)
app_update 232330 validate

// 任务完成后，退出 SteamCMD
quit
```

执行完毕后，CS:S 服务器文件将被完整地部署在 `~\css_server\` 目录下

## 第三步：基础框架安装 (SourceMod & MetaMod:Source)

SourceMod 和 MetaMod:Source 是所有高级插件运行环境的基础依赖

1.  **资源获取**：
    - **MetaMod:Source**: 从[官方网站](https://www.sourcemm.net/downloads.php)下载适用于 Windows 的最新稳定版 (Stable)
    - **SourceMod**: 从[官方网站](https://www.sourcemod.net/downloads.php)下载适用于 Windows 的最新稳定版 (Stable)
2.  **文件部署**：
    - 分别解压已下载的两个压缩包
    - 将解压后得到的 `addons` 和 `cfg` 两个文件夹，复制并合并到服务器的 `cstrike` 核心目录中
    - **目标路径**：`~\css_server\cstrike\`

## 第四步：核心插件部署：Shavit's Timer

Shavit's Timer 是广泛采用的 BHop/Surf 计时器插件，它提供了计时、排行榜、多风格支持及自动连跳等核心功能，推荐从其官方 GitHub 仓库获取最新版本

1.  **访问官方仓库**：[https://github.com/shavitush/bhoptimer](https://github.com/shavitush/bhoptimer)
2.  **定位发行版本**：在仓库页面右侧导航栏中，点击 **"Releases"**
3.  **下载**：选择最新的发行版本，在下方的 "Assets" 区域中，下载针对 CS:S 的预编译包，文件名通常为 `bhoptimer-v3.x.x.zip`
4.  **文件部署**：
    - 解压已下载的 `bhoptimer-v3.x.x.zip` 文件
    - 将其中的 `addons`, `cfg`, `maps` 等所有文件夹，复制并合并到服务器的 `cstrike` 核心目录中
    - **目标路径**：`~\css_server\cstrike\`

## 第五步：服务器配置

#### 5.1 启动脚本配置

在服务器根目录 (`~\css_server\`) 创建一个批处理文件 `start_server.bat`，内容如下：

```bash
@echo off
cls
:start
echo Starting server...
srcds.exe -game cstrike +sv_lan 0 -tickrate 100 +maxplayers 16 +map bhop_lego2 -port 27015
echo.
echo Server process terminated. Restarting in 10 seconds.
timeout /t 10 /nobreak
goto start
```

**参数说明**：

- `-tickrate 100`: 对 BHop 模式至关重要，可提供更平滑的物理模拟
- `+sv_lan 0`: 设定为公网服务器
- `+map bhop_lego2`: 定义初始加载地图

#### 5.2 服务器参数配置

在 `cstrike/cfg/` 目录下，创建或编辑 `server.cfg` 文件，此文件定义了服务器的主要运行参数

```bash
// server.cfg - Main Server Configuration

// --- General Information ---
hostname              "CSS BHop Server - Technical Deployment"
rcon_password         "YourComplexRCONPasswordHere" // 必须设置为高强度密码

// --- Core Gameplay Settings ---
sv_cheats             0       // 插件正常工作的前提
sv_airaccelerate      150     // BHop 核心参数，定义空中机动性
sv_enablebunnyhopping 1     // 启用原生连跳支持
sv_autobunnyhopping   1     // 启用原生自动连跳支持

// --- Server Rules ---
mp_friendlyfire       0       // 禁用友军伤害
mp_limitteams         0       // 移除队伍人数限制
mp_autoteambalance    0       // 禁用自动队伍平衡
mp_roundtime          0       // 移除回合时间限制
mp_freezetime         0       // 移除准备时间
sv_alltalk            1       // 启用全局语音

// --- Network & Resource Settings ---
sv_allowupload        1       // 允许客户端上传自定义内容 (如喷漆)
sv_allowdownload      1       // 允许客户端下载自定义内容 (如地图)
// sv_downloadurl    "http://your.fastdl.host/cstrike/" // (可选) 配置FastDL以加速资源下载

// --- Ban List Execution ---
exec banned_user.cfg
exec banned_ip.cfg
```

## 第六步：地图资源部署

1.  **获取地图**：从 [GameBanana](https://gamebanana.com/mods/cats/5568) 等资源库获取 `.bsp` 格式的 BHop 地图文件
2.  **部署地图**：将 `.bsp` 文件放置于 `cstrike/maps/` 目录
3.  **配置地图循环**：编辑 `cstrike/mapcycle.txt` 和 `cstrike/maplist.txt`，每行添加一个地图名称（不含 `.bsp` 扩展名）

## 第七步：网络配置与公网访问

为使服务器能从外部网络访问，必须在网络网关（路由器）上配置端口转发

1.  **登录路由器管理后台**
2.  **定位端口转发 (Port Forwarding) 功能**
3.  **创建转发规则**：
    - **外部端口**: `27015`, **内部端口**: `27015`, **协议**: `TCP/UDP`, **内部 IP**: 服务器所在主机的局域网 IP 地址
    - **外部端口**: `27005`, **内部端口**: `27005`, **协议**: `UDP`, **内部 IP**: 服务器所在主机的局域网 IP 地址
4.  **防火墙策略**：确保服务器主机的操作系统防火墙或任何安全软件已为 `srcds.exe` 创建入站和出站规则，允许上述端口的通信

## 第八步：启动与验证

1.  **执行** `start_server.bat` 脚本启动服务器进程
2.  **本地验证**：在 CS:S 客户端控制台中输入 `connect 127.0.0.1:27015` 进行连接测试
3.  **公网验证**：其他用户可通过服务器的公网 IP 地址进行连接

至此，CS:S BHop 专用服务器已完成全部部署，处于可运行状态
