---
title: Windows 上的 Rust：拥抱 GNU 工具链——MSVC 之外的选择
published: 2025-05-15
tags:
  - tech
  - rust
  - gnu
draft: false
toc: true
lang: zh
abbrlink: rustchains
---

## 前言

当你在 Windows 上进行 Rust 开发时，`rustup` 默认会为你配置 Microsoft Visual C++ (MSVC) 工具链 这通常是一个很好的选择，因为它与 Windows 生态系统紧密集成，并且与使用 Visual Studio 构建的 C/C++ 库具有良好的 ABI 兼容性

但是，如果你有以下情况，可能需要或更倾向于使用 GNU 工具链 (通常通过 MinGW-w64 实现)：

- 你不想安装庞大的 Visual Studio C++ Build Tools
- 你已经熟悉或正在使用 MinGW/MSYS2 环境进行其他开发工作
- 你的项目有特定依赖或需要 GCC 特有的功能
- 你希望编译的二进制文件依赖于系统自带的 `msvcrt.dll` (GNU 工具链的常见行为)

好消息是，Rust 的工具链管理器 `rustup` 非常灵活，让你能够轻松安装和切换到 GNU 工具链 这篇博文将指导你完成整个过程

## **为什么默认是 MSVC？**

在我们深入 GNU 世界之前，简单了解一下 MSVC 为何是 Windows 上的默认选择：

- **原生集成**: MSVC 是 Windows 平台原生的 C/C++ 编译器和链接器
- **ABI 兼容性**: 使用 MSVC 工具链编译的 Rust 代码可以更容易地与使用 Visual Studio 编译的 C/C++ 库链接
- **调试体验**: 与 Visual Studio Debugger 的集成通常更无缝

### **步骤 1: 安装 Rust (如果尚未安装)**

如果你是 Rust 新手，首先需要安装 `rustup` 访问 [https://rustup.rs/](https://rustup.rs/) 并按照说明进行操作 在安装过程中，如果检测到已安装 Visual Studio C++ Build Tools，`rustup` 可能会默认选择 MSVC 工具链

### **步骤 2: 检查当前已安装的 Rust 工具链**

打开你的命令行工具 (CMD, PowerShell, Git Bash 等)，运行以下命令来查看当前已安装和默认的工具链：

```bash
rustup toolchain list
```

你可能会看到类似这样的输出：

```bash
stable-x86_64-pc-windows-msvc (default)
nightly-x86_64-pc-windows-msvc
```

这里的 `(default)` 指明了当前 Cargo 命令会使用的工具链

### **步骤 3: 安装 MinGW-w64 GCC (GNU 工具链的 C/C++编译器基础)**

`rustup` 负责管理 Rust 自身的工具链部分，但它不包含 C/C++ 编译器 要使用 Rust 的 GNU 工具链，你首先需要一个可用的 MinGW-w64 GCC 编译器

**推荐方式：通过 MSYS2 安装 MinGW-w64**

MSYS2 提供了一个强大的 Unix-like 环境和包管理器 (`pacman`)，是获取和管理 MinGW-w64 工具链的优秀方式

1. **下载并安装 MSYS2**: 访问 [https://www.msys2.org/](https://www.msys2.org/) 下载安装程序并完成安装

2. **打开 MSYS2 MinGW 64-bit 终端**: 从开始菜单找到并运行 "MSYS2 MinGW 64-bit" (或 "MSYS2 MinGW x64") **重要的是使用 MinGW 变种的终端，而不是基础的 MSYS 终端，以确保环境变量正确设置 **

3. **更新包数据库和核心包**:

   ```bash
   pacman -Syu
   ```

   然后可能需要关闭终端，重新打开，再次运行：

   ```bash
   pacman -Su
   ```

4. **安装 MinGW-w64 GCC 工具链**:

   ```bash
   # 对于 64-bit Rust (最常见)
   pacman -S mingw-w64-x86_64-gcc

   # 如果你需要 32-bit Rust 的 GNU 工具链
   # pacman -S mingw-w64-i686-gcc
   ```

5. **将 MinGW-w64 的 `bin` 目录添加到系统 `PATH` (重要!)**:

   `rustup` 和 Cargo 需要能够找到 `gcc.exe` 作为链接器 你需要将 MinGW-w64 的 `bin` 目录添加到你的 Windows 系统 `PATH` 环境变量中
   - 如果 MSYS2 安装在 `C:\msys64`，那么 64 位工具链的路径通常是 `C:\msys64\mingw64\bin`
   - 对于 32 位工具链，路径通常是 `C:\msys64\mingw32\bin`
     编辑系统环境变量，将此路径添加到 `Path` 变量中 更改后可能需要重启命令行或计算机才能生效

**其他方式安装 MinGW-w64**:
你也可以从其他来源下载独立的 MinGW-w64 安装包 (例如从 [winlibs.com](http://winlibs.com/) 获取的预编译包)，并确保将其 `bin` 目录添加到系统 `PATH`

### **步骤 4: 使用 `rustup` 安装 Rust 的 GNU 工具链**

现在你已经有了一个可用的 GCC 编译器，可以告诉 `rustup` 安装对应的 Rust GNU 工具链了：

- 对于 64 位 Windows 上的 GNU 工具链 (`x86_64-pc-windows-gnu` target):

  ```bash
  rustup toolchain install stable-x86_64-pc-windows-gnu
  ```

  (你可以将 `stable` 替换为 `beta`, `nightly`, 或特定的版本号，例如 `1.70.0-x86_64-pc-windows-gnu`)

- 对于 32 位 Windows 上的 GNU 工具链 (`i686-pc-windows-gnu` target):

  ```bash
  rustup toolchain install stable-i686-pc-windows-gnu
  ```

安装完成后，再次运行 `rustup toolchain list`，你应该能看到新安装的 GNU 工具链

### **步骤 5: 管理和使用 GNU 工具链**

`rustup` 提供了多种方式来管理和激活你安装的工具链：

- **设为默认工具链**:
  如果你希望所有 Rust 项目默认都使用 GNU 工具链：

  ```bash
  rustup default stable-x86_64-pc-windows-gnu
  ```

- **为特定项目指定工具链 (推荐)**:
  这通常是更好的做法，因为它允许不同项目使用不同的工具链 在你的项目根目录下运行：

  ```bash
  rustup override set stable-x86_64-pc-windows-gnu
  ```

  这会在项目目录中创建一个 `rust-toolchain.toml` (或旧版的 `rust-toolchain`) 文件，锁定该项目使用的工具链

- **为单个 Cargo 命令临时指定工具链**:

  ```bash
  cargo +stable-x86_64-pc-windows-gnu build
  cargo +stable-x86_64-pc-windows-gnu run
  ```

## **MSVC vs. GNU: 做出选择**

| 特性             | MSVC (`*-pc-windows-msvc`)            | GNU (`*-pc-windows-gnu`)                                             |
| :--------------- | :------------------------------------ | :------------------------------------------------------------------- |
| **依赖**         | Visual Studio C++ Build Tools (较大)  | MinGW-w64 (相对较小)                                                 |
| **C/C++ 互操作** | 与 VS 编译的库兼容性好                | 与 GCC 编译的库兼容性好，与 MSVC 库链接可能复杂                      |
| **运行时**       | 通常链接到 UCRT (Universal C Runtime) | 通常链接到 `msvcrt.dll` (较旧，系统自带) 或 UCRT (取决于 MinGW 配置) |
| **调试**         | Visual Studio Debugger 集成良好       | GDB，调试体验可能因 IDE 而异                                         |
| **易用性**       | Windows 默认，对许多用户来说开箱即用  | 需要额外安装和配置 MinGW                                             |

**重要提示：ABI 兼容性**

这是一个关键点：使用 MSVC 编译的库 (`.lib`, `.dll`) 和使用 GCC (MinGW) 编译的库通常在 **ABI (Application Binary Interface) 上是不兼容的** 这意味着你不能轻易地将 MSVC 编译的 Rust 代码链接到 GCC 编译的 C/C++ 库，反之亦然，除非这些库是以纯 C ABI 导出的，并且小心处理了运行时库的依赖 如果你需要与特定的 C/C++ 库交互，请确保你的 Rust 工具链与该库的编译方式匹配

## Happy Rusting!
