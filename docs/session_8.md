> **编者注（session 9 添加）：** 本文件是 session-7 整改（S7-1…S7-13，提交 `131220a`）的执行叙述日志。 Remediation Plan 中编号为 "Session 7" 的计划段由本运行执行 —— 文件名按运行序号递增，与计划段落编号存在一位漂移，属预期现象，后续审计员请以此注为准。

我将开始执行这项全面的审计和修复任务。首先，让我检查一下工作区状态和上传的文件。
我已内化上述操作说明（生产级标准、基于证据的验证、适用于当前任务的 Mode C 审计模式）。现在让我来刷新工作区：
仓库已成功克隆。Git 历史记录显示已完成 6 轮修复（session-6 是最新的）。让我来探索一下仓库结构：
现在让我来审阅整改计划、工作日志和 `session_6.md`：
现在让我查看 skills catalog 和 SKILL.md 的摘要部分：
文档审查完成。我现在对项目状态有了全面的了解（session-6 已完成，所有审查门槛均已通过：174 unit / 39 e2e）。让我更新我的待办事项（todos）并搭建环境：
**已确认环境遮蔽陷阱** —— 沙箱 shell 导出 `DATABASE_URL=file:/home/z/my-project/db/custom.db`，这会覆盖仓库的 `.env` 文件。我将对所有 DB 命令使用显式覆盖。正在安装依赖：
DB 已成功植入至 `db/custom.db`（仓库根目录）。现在开始运行完整的门控链以重新验证 session-6 的声明：
Build requires `.env` (git-ignored, fresh clone). Let me create it from `.env.example`:
E2E web 服务器启动超时。让我来诊断一下：
找到了——被覆盖的 sandbox `DATABASE_URL` 破坏了独立服务器的数据库连接（健康检查返回 `db: down` → 可能是非 2xx 的就绪探针）。这正是 AGENTS.md 中记录的 env-shadowing 陷阱。我来消除这个覆盖并重新运行：
已确认 —— `db:down` → 503 → readiness probe 失败。正在使用 neutralized shadow 重新运行 e2e：
所有 session-6 门禁已在全新 clone 上验证通过（green）：lint ✓ · typecheck ✓ · typecheck:tests ✓ · 174/174 unit ✓ · build ✓ · **39/39 e2e ✓**。现在正在针对在线（LIVE）参考站点验证视觉一致性：
参考网站未变更（首页结构相同，包含 8 个分类，精选商品名称/价格/数量一致）。让我登录参考网站以检查账户端的功能：
参考网站已登录 —— 页眉未更改（没有新的导航项）。让我快速查看一下产品列表页，看看是否有任何新功能：
参考网站在所有界面均保持稳定。现在正在与本地克隆进行对比验证：
Clone home matches the reference. Now testing the mobile navigation menu (Tailwind v4 regression guard):
Mobile menu fully verified: open (`expanded=true`, push-down panel) → navigate → closes, lands on `/products`. Tailwind v4 conditional-mount pattern intact. Now launching the fresh deep audit:
现在正在启动只读深度审计子智能体（使用仓库的 `code-review-checklist` 12 类扫描），同时我将亲自验证特定层面：
审计完成：**1 个高优先级已整合，1 个部分完成**，新增发现 **2 个中优先级 / 8 个低优先级 / 3 个建议**。在规划之前，让我亲自验证一下这些关键发现：
**S7-1 已确认** —— 在 `safeCreateCart` 的第 151 行，P2002 回退返回了访客购物车行（`userId: null`）但未对其进行认领。让我验证一下 S7-2 和 S7-3：
**S7-2 已确认** — 第 221 行的 P2002 恢复路径跳过了 `replayAuthorized` 门控。现在正在验证 S7-3（种子重置）：
**S7-3 已确认** —— product upsert `update: data` 会在 re-seed 时覆盖 stock/rating/reviewCount/price；settings upsert 会重置管理员的修改。让我批量验证剩余的发现：
所有发现均已确认。让我检查一下剩余的细节 —— wishlist claim gap、`replayAuthorized` 以及 product og:image：
All findings verified with evidence. Now writing the session-7 remediation plan:
计划已保存。现在开始 **TDD 红灯阶段** —— 首先为新模块编写失败测试。让我检查一下现有的测试规范：
现在正在编写 RED 测试 — 为新的 pure helpers 创建一个新的 unit test 文件：
让我修复 U+2028 测试以使用显式转义（通过工具参数的字面不可见字符是不可靠的）：
Write 工具确实正确写入了字面上的 U+2028/U+2029 字节 —— 该文件在功能上是正确的。让我添加一个正向断言并继续：
现在，我正在将验证测试扩展至 S7-6（仅根相对图片）和 S7-7（价格限制）——这些是对现有用例的修改：
现在正在确认 RED 状态 —— 新测试必须失败：
**RED 已确认**（4 个验证失败 + 会话文件因缺少模块而未能成功收集）。现在进入 **GREEN 阶段** —— 先实现纯模块：
Seed 已经通过相对路径导入了 `../src/lib/password` —— 保持了相同的模式。现在将 `jsonLdScript` 添加到 seo.ts，并将 `resolveReplay` 添加到 order-access.ts：
现在将 `resolveReplay` 添加到 order-access.ts：
接下来是 `interpolateContactEmail` —— 让我检查一下法律内容模块的结构：
现在正在通过法律页面绑定插值（interpolation）：
测试文件在 `interpolateContactEmail` 没有被导入的情况下就使用了它 —— 让我来修复导入并检查 `auth.ts`：
将 `sessionSweepDue` + 每小时一次的机会性清除添加到 `auth.ts`：
现在更新验证 schema（S7-6 仅根相对模式 + S7-7 价格上限）：
正在修复测试文件中缺失的 import：
转义运行正常 —— 我的第二个断言出错了（`>` 从未被转义，只有 `<`）。正在修复断言：
所有 48 个单元测试均已通过。现在正串联修复方案——首先是 **S7-1**（`safeCreateCart`/`safeCreateWishlist` 中的受保护认领）：
现在进行针对 S7-1 的端到端（e2e）测试（跨设备申领）。正在检查现有的认证（auth）规范模式：
该测试存在并行缺陷（`demo user` 可能已经拥有其他测试并行创建的购物车）。现将其重写，改为使用专用的新注册用户，以便准确地触发首次登录路径：
现在正在将 S7-2 接入到 checkout 重试循环中：
接下来是 S7-8 —— 地址上限。正在读取相关代码：
正在为地址上限（S7-8）编写 e2e RED 测试。首先检查 addressSchema 的结构：
现在开始实施 S7-8 —— 共享地址库模块 + 布线：
现在正在绑定地址 POST 的上限和结账时的 saveAddress：
MultiEdit 将路由混淆了。正在将它们分开处理：
文件状态混乱——让我检查一下当前状态并进行干净的修复：
两次编辑确实都已应用 —— 只是 import 缺少 `AddressCapError`。正在修复：
现在处理 checkout 路由中的 `saveAddress`（先验证其当前状态）：
S7-8 已连接。现在 S7-3 — 将种子策略接入 prisma/seed.ts：
S7-3 已连接。现在处理 S7-4 —— 4 个手写的 base-URL 站点：
现在进行 S7-9 —— 3 个 JSON-LD 脚本块：
正在更新商品页面中针对 S7-6 的过期 og:image 注释：
接下来 S7-10 (checkout-client newRequestId)、S7-11 (搜索/购物车摘要 try/catch) 以及 S7-13 (心愿单标签)：
现在进行 S7-10（`checkout-client` 回退）和 S7-11（`search/cart-summary` 尝试/捕获）：
正在检查残留的 S7-6 引用（提到 `http(s)` 图片的 UI 文案）：
所有 197 个单元测试均已通过（从 174 个增加）。剩余的 `http(s)` 提及内容是链接 schema（ctaLink、socials）——导航链接，而非图片；是正确的。正在运行 typecheck + lint：
在 random-id 测试中，mock 的签名类型检查失败。正在简化 `CryptoLike` 接口以精确匹配实际用法（`Uint8Array`）：
两个类型检查均已通过。现在正在使用实时数据验证 S7-3（reseed 不得重置实时数据）：
**S7-3 已实时验证** — 变更后的库存/价格/评分/评论数/设置在重新植入数据（re-seed）后均得以保留，而目录内容（名称/描述）已更新。正在将测试变更恢复至种子默认值：
所有修复已完成。正在检查面向管理员的产品对话框中是否有任何陈旧的图片 URL 指导文本：
没有过时的文案。现在正在运行生产构建（build）和完整的 e2e 测试套件：
**所有 41/41 个 e2e 测试已通过**（39 个原有测试 + 2 个新测试）。全链路验证通过（GREEN）：lint ✓ · typecheck ✓ · typecheck:tests ✓ · **197/197 unit** ✓ · build ✓ · **41/41 e2e** ✓。现在通过 agent-browser 对修复后的构建版本进行手动验证：
法律页面渲染了 14 次 `hello@homenest.com`，因为 `settings.contactEmail` 的默认值确实是该地址——token 已被正确替换（无原始 token）。让我验证一下插值是否使用了实时设置：
**S7-5 实时验证** —— 修改设置后，14 个法律正文段落已全部更新。但我的恢复操作可能使用了错误的值 —— 正在检查种子数据的原始值：
已恢复至真实的种子值。现在正在验证修复后构建版本上的移动端菜单和结账功能：
所有手动验证均已通过。正在关闭浏览器并刷新截图：
23 张截图已刷新。现在正在更新文档 — 首先是 DEPLOYMENT.md 的 seed 段落：
现在正在使用 session-7 invariants 更新 AGENTS.md：
让我确认一下 `AGENTS.md` 在这些编辑之后是否仍然包含 `review-aggregates` 不变量：
“Review aggregates”不变量被误替换了。正在恢复它：
AGENTS.md 已修复。现在正在更新文档中的测试计数：
正在更新 CLAUDE.md 的测试策略和模块列表：
正在更新 README 中的 Accounts 行，以包含 address cap：
正在检查 PAD 中需要 session-7 更新的已知问题/安全章节：
正在更新 PAD 计数、seed 部分、测试表格和已知问题：
正在撰写 docs/session_7.md 叙述：
正在将 session-7 条目追加到 worklog.md：
正在修正计划中预先编写的总数，以符合观察到的实际情况：
现在进行最后的提交。正在检查 `git status` 并准备提交：
已提交 `131220a` 到 main 分支。现在进行 SSH 推送 —— 首先阅读 wrapper 技能文档：
没有 ssh 二进制文件，也没有 paramiko。正在安装 paramiko 并部署 Appendix A shim：
现在正在将经过实战检验的 shim 部署到代码仓库之外：
密钥解析为有效的 Ed25519。正在执行 dry-run：
包装器的默认远程仓库（default remote）指向了错误的仓库 —— 需要显式地使用 `--remote`：
空运行确认了 fast-forward `1c0b480..131220a`。正在执行实际推送：
推送已验证 — 远程 `main @ 131220a == local HEAD`。现在正在销毁操作员密钥：
推送完成并已验证。最终清理与工作区工作日志：
**第 7 次会话已完成并推送到 `main` 分支 (`131220a`)。** ✅

## 已完成的工作

**1. 端到端重新验证** — 全新克隆（HEAD 位于 `1c0b480`）；每个 session-6 门控均已通过（lint · typecheck · typecheck:tests · 174 unit · build · 39 e2e；沙箱 `DATABASE_URL` 阴影已按文档说明进行中和）；`.env` 从 `.env.example` 重新创建（`file:../db/custom.db` 契约 + 强大的 `AUTH_SECRET`）；确认 `db/custom.db` 位于仓库根目录。针对**实时参考（已登录）**的视觉对等性 —— 参考未变，克隆版本仍然是超集；**移动菜单在生产构建版本上重新验证**（Tailwind v4 条件挂载完好无损）。

**2. 全新深度审计**（repo `code-review-checklist`，已排除 `skills/`）— session-6 修复：13 个 WIRED / 1 个 PARTIAL / 0 个 MISSING；新发现：**2 个 MEDIUM / 8 个 LOW / 3 个 NIT**，每个在规划前都经过了个人验证。重点：访客购物车/愿望清单在首次登录时**从未被声明**，`db:seed` **重置了实时商店数据**，幂等性恢复路径绕过了所有权门控，JSON-LD 未转义，基础 URL 有 5 个来源，法律正文硬编码了联系电子邮件，图像接受了 CSP 阻止的 URL。

**3. TDD 补救措施 (S7-1…S7-13)** — 所有测试均先变红后变绿：受保护的访客购物车声明（跨设备 e2e）、`resolveReplay` 所有权门控、**在验证重新播种期间，实时的 store 数据在重新播种后依然存在**的种子策略、`siteBaseUrl()` 单一来源、`{{contactEmail}}` 标记化（实时设置切换已验证）、仅根相对的图像验证、价格边界、地址簿上限 20 + 确定性默认值（e2e）、`jsonLdScript` 转义器、安全上下文安全的结账密钥、一致的 500 形状、每小时一次的会话清理、产品名称的愿望清单标签。

**4. 最终状态** — **197/197 unit · 41/41 e2e · 所有门控绿色通过**；23 张屏幕截图已刷新；AGENTS/CLAUDE/README/PAD/DEPLOYMENT/SKILL v1.4.0/worklog/session_7.md 已对齐；通过 SSH 包装程序推送（预运行 → 推送 → 远程引用已验证 → 密钥已粉碎）。仅推送了 main 分支，未创建任何新分支。

**建议的下一步：** 尚在记录中的主要推迟项是真实的支付提供商和电子邮件投递——两个幂等性/所有权衔接点都已为此准备就绪；愿望清单填充状态是下一个功能级别的增强。
