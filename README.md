# 一个基于 React + TypeScript + Vite + Gemini API 的 PDF 转 PNG 应用

```
主要功能（完整）
批量转换
单文件 / 整个文件夹批量 PDF → PNG
自动遍历子目录
高清输出
自定义 DPI（100–600+）
支持缩放比例（1x–5x）
无损 PNG 压缩
页面控制
全部页 / 指定页 / 页码范围
支持多页 PDF 拆分为单张 PNG
质量与格式
输出：PNG（透明 / 白底）、JPG、WEBP
可设置背景透明
易用性
命令行 + 简易 GUI（可选）
进度条、日志、错误重试
输出按原文件名 + 页码命名

```

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b467d0cc-945e-4005-8fe0-f1c620535d26

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


