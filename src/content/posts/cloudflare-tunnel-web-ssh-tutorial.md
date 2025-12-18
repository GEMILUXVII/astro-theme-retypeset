---
title: '利用 Cloudflare Tunnel 搭建一个浏览器端的ssh页面'
published: '2025-11-27'
draft: false
tags: ['tech', 'server', 'cloudflare']
---

### 引言：什么是 Cloudflare Tunnel？

Cloudflare Tunnel (以前叫 Argo Tunnel) 是 Cloudflare 提供的一项免费服务。它的工作原理是在你的服务器内部运行一个轻量级的守护进程（`cloudflared`），这个进程会主动向 Cloudflare 的全球边缘网络发起一个加密隧道连接。

当外部用户访问你设定的域名时，请求会先到达 Cloudflare 最近的节点，然后通过这个加密隧道直接转发到你服务器的内部端口。

**使用 Tunnel 做 SSH 的好处在于：**

1.  **加速连接**：流量走的是 Cloudflare 优化的全球骨干网，避开了拥堵的公网线路。
2.  **浏览器即客户端**：你可以在任何设备（iPad、手机、网吧电脑）上，只要有浏览器就能管理服务器，无需安装专门的 SSH App。
3.  **安全性爆表**：你的服务器甚至不需要拥有公网 IP，也不用开放 22 端口给公网。并且，Cloudflare 会在 SSH 前面加一把“锁”（比如邮箱验证），只有你认证通过了才能看到 SSH 登录界面。

### 准备工作

- 一台 Linux 服务器（本文以一台新加坡服务器为例）。
- 一个托管在 Cloudflare 上的域名 。
- Cloudflare 账号（免费版即可）。

### 搭建步骤

整个过程在 Cloudflare 的网页后台即可完成，无需复杂的配置文件。

#### 第一步：创建隧道并安装连接器

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，在左侧菜单栏找到并点击 **Zero Trust**。

![pic-1.png](https://imgbed.aspchang.cn/file/1764332878989_pic-1.png)

:::note
开启Zero Trust需要绑定一张外币卡（不会进行扣费）
:::

2.  在 Zero Trust 面板中，导航至 **网络** -> **连接器**，点击 **创建隧道**。

![image.png](https://imgbed.aspchang.cn/file/1764333763071_image.png)

3.  连接器类型选择默认的 Cloudflared，点击 Next。给隧道随便起个名字（例如 `web-ssh-sg`），保存。

4.  在接下来的页面中，选择你服务器的操作系统架构（通常是 Linux/Debian/64-bit）。

5.  页面下方会生成一串安装命令。复制这行命令，登录到你的服务器终端粘贴并运行。

![image.png](https://imgbed.aspchang.cn/file/1764333332425_image.png)

当命令执行完毕，网页上的隧道状态变绿色时，说明隧道已打通。

#### 第二步：配置内网穿透（Public Hostname）

这一步的目的是告诉 Cloudflare：当有人访问特定域名时，把请求转发给服务器的哪个端口。

紧接上步，配置路由隧道

![image.png](https://imgbed.aspchang.cn/file/1764333832789_image.png)

- **子域名**: 可选项，比如 `ssh`。
- **域**: 选择你已托管到 Cloudflare 的域名。
- **路径**: 留空。
- **服务**:
  - 类型 选择 **SSH**。
  - URL 填入 `localhost:22`。（如果你修改过 SSH 端口，请填写对应的端口号）。

![image.png](https://imgbed.aspchang.cn/file/1764334012162_image.png)

保存后，Cloudflare 就知道该把 `ssh.yourdomain.com` 的流量往哪里送了。

#### 第三步：配置浏览器渲染（最关键的一步）

到目前为止，隧道虽然通了，但如果你直接访问那个域名，浏览器是不知道如何解析 SSH 协议的。我们需要借助 Cloudflare Access 的能力把它渲染成网页。

1.  在 Zero Trust 左侧菜单，点击 **访问控制** -> **应用程序**，点击 **添加应用程序**。

![image.png](https://imgbed.aspchang.cn/file/1764334117362_image.png)

2.  选择 **自托管**。

3.  **配置应用基本信息**：

- **应用程序名称**: 随便填，如 `My Web Terminal`。

- **会话持续时间**: 选择登录状态保持多久，如 `24h`。

- **添加公共主机名**: **必须**填写你在第二步设置的完整域名，将子域，域都正确填入（例如 `ssh.yourdomain.com`）。

4.  **设置浏览器渲染（重中之重）**：

- 点击下方的 **浏览器呈现设置** 标签页。
- 向下滚动找到 **浏览器呈现** 选项。
- 在下拉菜单中，务必选择 **SSH**。

![image.png](https://imgbed.aspchang.cn/file/1764334309105_image.png)

5.  **配置身份验证策略**：

为了安全，你需要设置谁能访问。例如，设置规则为 “Email” “Is” “你的邮箱地址”，这样只有你能接收验证码登录。

![image.png](https://imgbed.aspchang.cn/file/1764334454426_image.png)

![image.png](https://imgbed.aspchang.cn/file/1764334429685_image.png)

_如果不做这最后一步，访问域名时浏览器会尝试下载文件，而不是显示终端界面。_

点击保存，大功告成！

### 最终体验

现在，打开你喜欢的浏览器，访问你设置好的域名（如 `https://ssh.yourdomain.com`）。

1.  首先是 Cloudflare 的安全验证页面。输入你的邮箱，获取并填入验证码。
2.  验证通过后再输入用户名和私钥密码即可登录到终端。

这样我们就搭建好了一个可以网页访问的 ssh 终端。
