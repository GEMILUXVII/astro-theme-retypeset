---
title: PowerShell 7 启动速度优化：从 2000ms 到 400ms
published: 2026-01-06
tags:
  - tech
  - conda
  - powershell
draft: false
toc: true
lang: zh
abbrlink: conda-powershell7
---

之前在自己电脑上用的 Powershell 7，但是呢启动老是很慢，有多慢呢，慢到 Loading personal and system profiles took 他妈的两千多 ms，直到昨天我终于受不了了，想起了之前用过的 nushell，遂换回 nushell，但是 nushell 还是老毛病，无法兼容 conda，此时我想到会不会我 PS7 启动慢的原因就是 conda 的原因呢，故有了这篇博客。

## 前言：Windows 终端的“不可能三角”

在 Windows 上做开发（尤其是 Python/Rust），总会陷入一个终端选择的怪圈：

* **CMD**：启动极快，但功能简陋，连 `ls` 都没有。
* **Nushell**：现代、极速、结构化数据很爽，但对 Conda 虚拟环境的支持极其糟糕，生态隔离严重。
* **PowerShell**：兼容性最好，Conda 原生支持，但是**启动太慢了**！动辄 2-3 秒的加载时间，对于习惯了 Linux 秒开体验的人来说简直是折磨。

在尝试了 Yori、Git Bash、Clink 等各种方案后，我最终决定：**回归 PowerShell 7，但通过配置将其彻底“魔改”，实现速度、功能与颜值的完美统一。**

本文将分享我是如何将 PowerShell 的启动速度从 **2000ms+ 优化到 400ms**。

---

## 第一步：寻找“启动慢”的真凶

默认的 PowerShell 7 其实不慢，慢的是我们装的工具。经过排查，导致卡顿的核心原因有两个：

1. **Conda 的全量初始化**：`conda init` 会在配置文件里塞入一大段脚本，每次启动终端都会运行 `conda.exe` 进行检测，这是最大的延迟来源。
2. **隐蔽的全局配置文件**：即使清空了自己的 `$PROFILE`，Conda 甚至可能把代码写在 `AllUsersAllHosts` (`$PSHOME\Profile.ps1`) 里，导致你以为清理干净了，其实它还在后台偷偷跑。

### 解决方案：Conda 懒加载 (Lazy Loading)

核心思路是：**启动时不加载 Conda，直到我第一次输入 `conda` 命令时，才瞬间加载它。**

这样可以实现 **400ms 延迟启动**。只有当你真正需要用 Conda 时，才会付出那 0.5 秒的加载成本。

---

## 第二步：打造“跟手”的输入体验 (复刻 Nushell)

Nushell 最吸引人的地方在于它的**历史记录预测（幽灵文字）和列表式补全**。其实 PowerShell 7 自带的 `PSReadLine` 模块完全可以做到这一点，只是默认没开启。

我们需要开启：

* `ListView`：按 Tab 键时弹出菜单选择，而不是一个个切。
* `InlinePrediction`：根据历史记录显示灰色的预测文字，按 `→` 直接补全。

---

## 第三步：颜值与细节修复

1. **解决双重提示符**：Conda 激活后会强制在前面加 `(env_name)`，和 Starship 的显示重复了。需要在 `.condarc` 里设置 `env_prompt: ""`。
2. **修复 `ll` 命令**：Windows 没有 `ll`，通过函数别名实现 `ls -Force`。

---

## 最终成品

### 1. 清理旧环境

首先，检查全局配置文件，删掉里面所有 Conda 自动生成的代码（这一步至关重要，否则优化无效）：

```powershell
notepad $PSHOME\Profile.ps1
```

### 2. 配置个人 `$PROFILE`

运行 `code $PROFILE` 或 `notepad $PROFILE`，全选粘贴以下代码。这是集成了**懒加载、Starship、智能补全、错误修复**的终极配置：

```powershell
# =============================================================================
# Conda 懒加载
# =============================================================================
# 请修改为你的 miniconda/anaconda 安装路径
$env:CONDA_HOME = "D:\miniconda3"

function conda {
    # 移除这个“假”函数
    Remove-Item Function:\conda -ErrorAction SilentlyContinue

    # 找到真正的初始化脚本
    $CondaHook = "$env:CONDA_HOME\shell\condabin\conda-hook.ps1"

    if (Test-Path $CondaHook) {
        # 只有在真正输入 conda 时才运行这段耗时代码
        & $CondaHook
        # 自动激活 base 环境 (可选)
        conda activate base
    }

    # 补发刚才拦截的用户命令 (比如 'conda activate env')
    if ($args.Count -gt 0) { Invoke-Expression "conda $args" }
}

# =============================================================================
# Starship 主题
# =============================================================================
# 确保你已经安装过 starship
Invoke-Expression (&starship init powershell)

# =============================================================================
# 智能补全
# =============================================================================
Import-Module PSReadLine -ErrorAction SilentlyContinue

try {
    # 列表视图：按 Tab 弹菜单
    Set-PSReadLineOption -PredictionViewStyle ListView
    # 幽灵提示：历史记录预测
    Set-PSReadLineOption -PredictionSource History
    # 设置预测文本颜色 (PS 7.5+ 使用 InlinePrediction)
    Set-PSReadLineOption -Colors @{ "InlinePrediction" = [ConsoleColor]::DarkGray }
} catch {}

# =============================================================================
# 实用工具别名
# =============================================================================
# 让 Windows 也能用 ll 查看详细列表 (含隐藏文件)
function ll { Get-ChildItem -Force -Verbose $args }

fastfetch

```

### 3. 去除 Conda 重复提示符

为了防止 Conda 的 `(base)` 和 Starship 重复显示，修改 Conda 配置文件：

```powershell
notepad $env:USERPROFILE\.condarc

```

在末尾添加：

```yaml
env_prompt: ''
```

---

如此这般这般如此我便解决了PS7启动奇慢的问题
