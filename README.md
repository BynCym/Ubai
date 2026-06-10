# Ubai - 专注时光

一款干净、轻量的番茄钟桌面应用。

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## 功能

- 番茄钟计时（25 分钟 / 自定义时长）
- 背景音（雨声、海浪、风声、篝火）
- 液面波浪进度动画
- 专注数据统计（时段分布、趋势图、历史记录）
- 内置精选风景照 + 自定义背景上传
- 鼠标微视差效果
- 颂钵提示音

## 下载

前往 [Releases](../../releases) 页面下载对应系统的安装包。

| 系统 | 文件 |
|------|------|
| Windows | `Ubai Setup *.exe` |
| macOS | `Ubai-*.dmg` |
| Linux | `Ubai-*.AppImage` |

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) (v18+)

### 运行

```bash
npm install
npm start
```

### 打包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 技术栈

- [Electron](https://www.electronjs.org/) - 桌面应用框架
- HTML / CSS / JavaScript - 前端

## 开源协议

[MIT](LICENSE)
