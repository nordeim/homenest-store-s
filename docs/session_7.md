我将继续执行此全面的代码库修复任务。注意，文档审查列表现在包含 **`docs/session_6.md`**（已从 session_5 更新）。让我先制定一个待办事项清单并刷新工作区。
现在我来检查当前工作区状态并克隆仓库：
我已内化操作说明（模式 A–D 工作流、TDD 原则、基于证据的验证、根源规范、最小化精准修改）。仓库克隆成功 —— Git 历史显示 6 轮修复已完成（最新 `b7010e0` = session-6），HEAD 在 `1c0b480`（session 日志更新）。
审阅 AGENTS.md / CLAUDE.md / README.md / Project_Architecture_Document.md / homenest-store-s_SKILL.md v1.3.0 后，再审阅 docs/REMEDIATION_PLAN.md（session 2–6 全记录）、worklog.md、docs/session_6.md，并与代码库对照验证。
**环境遮蔽陷阱再次确认**：沙箱 shell 导出 `DATABASE_URL=file:/home/z/my-project/db/custom.db`，覆盖仓库 `.env`。所有 DB 命令显式覆盖。`.env`（git-ignored，新 clone 不存在）从 `.env.example` 重建：`DATABASE_URL="file:../db/custom.db"` + 强随机 `AUTH_SECRET`；`npm run db:setup` 将 `db/custom.db` 正确播种在仓库根目录。
运行完整门禁链重新验证 session-6 声明：lint ✓ · typecheck ✓ · typecheck:tests ✓ · 174/174 unit ✓ · build ✓ · 39/39 e2e ✓（webServer 需 DATABASE_URL 覆盖 —— 否则 standalone server 健康检查 503、Playwright 探针超时，正是 AGENTS.md 记录的陷阱）。
对照 LIVE 参考站（agent-browser 登录）验证视觉一致性：主页 hero、信任徽章、8 个分类、精选商品（名称/价格/数量完全一致）、商品列表页 —— 参考站未变，克隆站仍是超集。移动端菜单在生产构建上重验（iPhone 视口：open → `expanded=true` 下推面板全链接；导航 → 关闭并落地 `/products`）—— Tailwind v4 条件挂载模式完好。
启动只读深度审计子代理（仓库 code-review-checklist 12 类扫描，覆盖所有 src/lib 模块、10 个 API 路由、3 个 action 文件、全部店面/管理页面、配置、seed + schema，排除 skills/）：**13 项 session-6 修复 WIRED / 1 PARTIAL（S6-11 法务正文残留）/ 0 MISSING**，新增发现 **2 MEDIUM / 8 LOW / 3 NIT**。
逐一亲自验证关键发现（evidence-based）：
- **S7-1 (MEDIUM)** 确认：`safeCreateCart`/`safeCreateWishlist` 的 P2002 回退返回访客行而从不认领 —— 首次登录路径上 `User.cart` 关系永不物化（schema 注释 "claims userId on login" 是死代码）；第二设备登录会静默抛弃第一设备的购物车。
- **S7-2 (LOW)** 确认：checkout 重试循环 `placeOrderWithRetry` 在 `uniqueTarget === "idempotencyKey"` 时无条件返回 `winner.number` —— 绕过 S6-8 的 `replayAuthorized` 门禁。
- **S7-3 (MEDIUM)** 确认：`prisma/seed.ts` 商品 upsert `update: data` 会重置 stock/rating/reviewCount/price/badge；settings upsert 重置管理员编辑；DEPLOYMENT.md 的 seed 段落与之矛盾。
- S7-4/S7-5/S7-6/S7-7/S7-9/S7-10/S7-11 批量 grep 验证（4 处 base URL 手写回退、法务正文 7 处硬编码邮箱、3 处未转义 JSON-LD、checkout `crypto.randomUUID()`、search/cart-summary 无 try/catch 等）。
编写 session-7 整改计划（追加至 docs/REMEDIATION_PLAN.md，S7-1…S7-13 + 8 项延期及理由）。
**TDD RED**：新建 `tests/unit/session7-hardening.test.ts`（resolveReplay×4、productSeedUpdate×2、create-only×1、interpolateContactEmail×3、jsonLdScript×4、newRequestId×3、sessionSweepDue×3）；扩展 validation.test.ts（http(s) 拒绝翻转、价格上限）。RED 确认（4 validation 失败 + session7 文件因模块缺失无法收集）。
**GREEN** —— 纯模块先行：
- `src/lib/random-id.ts`（S7-10 newRequestId + CryptoLike）
- `src/lib/seed-policy.ts`（S7-3 productSeedUpdate 内容字段白名单 + SETTINGS/SLIDES_CREATE_ONLY）
- `src/lib/order-access.ts` 增 `resolveReplay` + `ReplayDeniedError`（S7-2）
- `src/lib/seo.ts` 增 `jsonLdScript`（S7-9：`<`→`\u003c`、U+2028/2029）
- `src/lib/auth.ts` 增 `sessionSweepDue` + 每小时机会式 sweep（S7-12）
- `src/lib/validation.ts`：imageUrlSchema 仅根相对（S7-6）、price/compareAtPrice `.max(100_000_000)`（S7-7）
- 法务 `content.ts` 7 处 `{{contactEmail}}` + `interpolateContactEmail`，页面渲染时替换（S7-5）
48/48 通过。随后接线：
- **S7-1**：cart.ts/wishlist.ts 受保护认领 `updateMany({ where: { id, userId: null } })`（绝不窃取他人行；输掉竞态自愈）；新增跨设备 e2e（专用新注册账号保证确定性）
- **S7-2**：checkout 重试循环经 `resolveReplay`（同客户端真实双击通过；泄露 key → 409）
- **S7-3**：seed 接线 productSeedUpdate + settings/slides create-only；**实时验证**——篡改 stock=7/price=12345/rating=3.3/reviewCount=99/setting=999999 后 re-seed，全部存活，目录内容（name/description）正常刷新；随后还原种子值
- **S7-4**：layout.tsx/sitemap.ts/robots.ts/storefront layout 4 处接入 `siteBaseUrl()`
- **S7-8**：新 `src/lib/addresses.ts`（MAX_ADDRESSES_PER_USER=20 + AddressCapError + assertAddressCap）；addresses POST 409；checkout saveAddress 满额跳过（订单照常）+ 同事务 unset 旧默认；新增 addresses-cap e2e
- **S7-9**：3 处 ld+json 经 `jsonLdScript`
- **S7-10**：checkout-client 经 `newRequestId()`
- **S7-11**：search/cart-summary `{error}` 500 形状
- **S7-13**：心愿单心形 aria-label 携带商品名（"Add {name} to wishlist"，grid 中不再同标签）
修正 random-id 的 CryptoLike 类型（getRandomValues 签名）后 typecheck:tests 绿。
完整门禁链：lint ✓ · typecheck ✓ · typecheck:tests ✓ · **197/197 unit** ✓ · build ✓ · **41/41 e2e** ✓（新增：S7-1 跨设备认领、S7-8 地址上限）。
agent-browser + curl 手动验证修复后构建：3 个 ld+json 块（home 2 + product 3）无裸 `<`、JSON 可解析、price 21.99 + priceValidUntil 2027-10-12 + 绝对图片 URL；canonical/robots/sitemap 从 siteBaseUrl 渲染；法务页邮箱改 settings 即时 14 处跟随（live 证明 S7-5）后还原种子值；移动端菜单 open→面板全链接→导航关闭；心愿单标签带商品名；购物车页零控制台错误。
刷新 docs/screenshots/（23 张）。更新 AGENTS.md（7 项新不变量：认领、重放恢复门禁、seed 策略、地址簿、newRequestId、jsonLdScript、siteBaseUrl 单源；product-images 不变量改写为仅根相对；price 上限；review-aggregates 不变量补充 seed 侧保证）、CLAUDE.md（测试覆盖清单 + lib 模块清单）、README.md（197/41 徽标与计数、Accounts 行地址簿上限、单测/e2e 覆盖描述）、PAD（8.1/8.2 计数、§4.3 seed 策略、已知问题 #24/25/26、Key Files 计数）、DEPLOYMENT.md（seed 段落改写为 create-or-refresh）、SKILL.md v1.4.0（session-7 历史 + 状态行）、worklog.md。
**第 7 次会话完成并推送至 main 分支。** ✅

## 已完成工作

**1. 重新验证优先** — 新 clone（HEAD `1c0b480`）；session-6 全部门禁在拉取树上绿（lint · typecheck · typecheck:tests · 174 unit · build · 39 e2e）；`DATABASE_URL` 合同完好（`db/custom.db` 在仓库根，沙箱遮蔽用显式覆盖中和）；对照 **LIVE 参考站**（登录）重验视觉一致性 —— 参考站未变，克隆站仍是超集；**移动端菜单**重验（Tailwind v4 条件挂载完好）。

**2. 全新深度审计** — session-6 修复 13 WIRED / 1 PARTIAL / 0 MISSING；新发现 2 MEDIUM / 8 LOW / 3 NIT。核心：首次登录不认领访客购物车（不变量死代码）、seed 重置线上数据、幂等恢复路径绕过所有权门禁、JSON-LD 未转义、base URL 多源漂移、法务正文硬编码邮箱、CSP 对齐缺口、地址簿无界。

**3. TDD 补救 (S7-1…S7-13)** — 受保护认领（跨设备 e2e）；resolveReplay 所有权门禁；seed-policy 内容白名单 + create-only（**实时重播种验证**）；siteBaseUrl 4 站单源；{{contactEmail}} 令牌化（**实时设置切换验证**）；imageUrlSchema 仅根相对（CSP 对齐）；价格上限；地址簿上限 20 + 事务性单默认（e2e）；jsonLdScript 转义（3 站）；newRequestId 安全上下文回退；search/cart-summary 500 形状；每小时会话清扫；心愿单标签。

**4. 最终状态** — **197/197 单元测试 · 41/41 e2e 测试 · 全部门禁绿**；23 张截图刷新；AGENTS/CLAUDE/README/PAD/DEPLOYMENT/SKILL v1.4.0/worklog 对齐；经 SSH 包装程序推送。

**建议的下一步：** 真实支付提供商与邮件投递仍是记录在案的重大延期（幂等/所有权接缝已就绪）；心愿单心形填充态是下一个功能级增强（需跨商品网格线程 wishlist ids）。
