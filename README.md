# dapp-for-test

一个基于 React + Vite + TypeScript 的链上功能快速测试页面，目前优先支持 Solana。

## 线上地址

- GitHub Pages: [https://hyper-jinx.github.io/dapp-for-test/](https://hyper-jinx.github.io/dapp-for-test/)

## 项目用途

- 首页提供链测试目录：
  - Solana 链测试（已实现）
  - Aptos 链测试（占位）
- Solana 测试页功能：
  - 连接钱包（支持 Phantom、Solflare、Backpack）
  - 签名消息
  - 签名并发送交易（自转账 0.0001 SOL）
  - 构造并发送“较长交易”（多条 Memo 指令，序列化字节数可达 ≥ 1000B）
- 网络与 RPC：
  - 默认主网 `mainnet-beta`
  - 页面支持运行时切换 RPC Endpoint（输入框），并支持：
    - URL 参数：`?rpc=https://your.rpc.endpoint`
    - `localStorage` 持久化：`solanaRpcEndpoint`
    - 可选环境变量：`VITE_SOLANA_RPC`
- 发送策略：
  - 优先使用 `window.solana.signAndSendTransaction`（由钱包扩展提供）
  - 回退至 Wallet Adapter 的 `wallet.sendTransaction`（已配置合适的 preflight 选项）

## 本地开发

环境要求：Node.js 22（已提供 `.nvmrc`），Yarn 1.x。

```bash
nvm use
yarn install
yarn dev
```

## 构建与部署

- 本地构建：

```bash
yarn build
```

- 部署：GitHub Actions 自动构建并发布到 GitHub Pages（Workflow 见 `.github/workflows/deploy.yml`）。
- 路由：已为 GitHub Pages 子路径配置 `BrowserRouter` 的 `basename`，并提供 `public/404.html` 以支持前端路由回退。

## 重要提示

- 主网交易会产生真实费用，请先确认余额与手续费。
- 某些钱包/节点对签名长度、交易大小有约束；长交易功能用于极限测试，如失败请查看页面展示的模拟/链上日志。
- 预检参数与“长交易”的目标大小可在 `src/pages/SolanaTest.tsx` 中调整。
