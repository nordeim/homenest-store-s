我将按照任务清单开始执行。首先创建任务计划，然后刷新工作区并开始审阅。
我已完整阅读并内化了操作指令（Mode C 审计 → Mode B 调试 → Mode A 生成的混合模式，TDD、根因修复、证据驱动验证）。现在开始执行任务清单。

## 步骤 1：刷新工作区
工作区是干净的（无 repo 克隆）。现在克隆仓库：
克隆成功（HEAD = `9ed652d`，main 分支干净）。开始审阅项目文档：
README 显示项目已经过 30+ 轮修复（360 单元测试 / 64 E2E）。继续审阅核心文档：
Session 文档确认：session_31.md 是第 20 轮（session-19 审计周期）的叙事日志，session_32.md 是其原始执行日志。本轮是 **Run 21（session-20 审计周期）**。继续审阅 REMEDIATION_PLAN.md 和 worklog.md：
Worklog 完整掌握。现在检查 SKILL.md 项目状态部分和 skills-catalog，同时开始环境搭建：
环境影子已存在且 `/home/z/my-project/db` 是指向 `/home/z/homenest-store-s/db` 的符号链接。检查其有效性并搭建环境：
符号链接当前悬空（repo 的 `db/` 尚未创建，git-ignored）。一旦 `db:push` 运行它就会生效。现在搭建环境：
错误根因：沙箱影子 `DATABASE_URL` 指向悬空符号链接。解决方案：用显式 env 覆盖运行 db:push（Prisma 会创建 `<repo>/db/`，符号链接随之生效并收敛）：
数据库就绪（16 产品/8 分类/3 优惠券/2 用户），路径收敛成功（同一 inode）。现在重新验证所有门禁：
构建成功。运行 E2E 测试套件：
63/64 通过，1 个失败（`admin-coupons.spec.ts`）。正在重现并隔离：
分析根因：spec 假设管理员购物车为空，但管理员购物车在 DB 中是持久的。检查当前 DB 状态：
需要精确诊断。读取 playwright 配置和完整 spec：
**根因确认**：这是一个真实的测试隔离缺陷（session-20 审计的首个发现）。检查 admin.spec 是否并发操作管理员购物车：
**Run 1 根因定位**：Add-to-Cart 点击的 POST 双重触发（Playwright actionability 重派发）+ 对**持久化管理员购物车**的绝对 badge pin（`toHaveText("1")`）。检查购物车 UI 的移除控件以设计修复：
修复设计完成。现在启动生产服务器并加载 agent-browser 技能做实时对照检查：
参考站未变（Damascus-first、8 分类、-29%/(412)/$199.99）。检查参考站移动端菜单：
参考站移动菜单 = 5 主链接 + 关闭按钮（与文档一致）。现在检查克隆站：
移动菜单验证通过（7 链接 + 导航自动关闭 + Tailwind v4 条件挂载完好）。检查 SEO 表面和桌面视觉：
桌面视觉一致性确认（奶油底/赤陶橙/Playfair/同构 header）。验证参考站登录（用提供的凭据）：
参考站登录成功且状态未变。关闭浏览器，快速重查审计技能清单，然后启动深度审计：
现在启动只读深度审计子代理（Task 21-a，session-20 审计）：
审计报告收到：**0 CRITICAL / 0 HIGH / 0 MEDIUM，2 LOW + 2 NIT + 4 Informational，session-19 修复全部 WIRED**（连续第八轮无高危）。现在本人复核关键发现并确定修复范围：
检查 checkout 客户端和购物车汇总的金额镜像，确定 free-shipping 功能的完整爆炸半径：
爆炸半径确认完毕。现在撰写 Session-20 remediation plan 并追加至 `docs/REMEDIATION_PLAN.md`：
计划已保存。执行前再次对照代码库验证计划 — 读取关键实现细节：
模式已吸收。现在 TDD — **RED 阶段**：先写失败测试。创建 `tests/unit/session20-hardening.test.ts`：
Now extend the existing test files (RED for the rest of the engine change):
**RED 确认** — 运行新测试验证全部失败：
RED 确认（16 失败）。补上 validation.test.ts 缺失的 import：
验证 2 个失败（另 2 个是设计内的回归守卫）。**GREEN 阶段**开始 — 先实现 coupons.ts 引擎：
Now add `couponRedemptionFilter` next to `couponRedemptionWhere`:
Now `order-money.ts`:
Now the validation schema:
Now the `toggleCouponActiveAction` in admin.ts — placed next to its sibling product toggle:
Now wire the checkout route (filter + freeShipping):
发现作用域问题：`couponFreeShipping` 声明在 `if` 块内但 `computeOrderMoney` 在块外调用。修复：
Now the coupon/apply route passthrough:
现在更新客户端镜像（coupon-box + checkout-client）和提示文案（S20-7）：
Now checkout-client.tsx — the AppliedCoupon type + the shipping mirror:
现在改 coupon-dialog.tsx（类型选项 + 值重置 + 窄 toggle 接线）。先读相关段落：
需要查看完整 JSX 结构来正确修复条件包裹的闭合标签：
Now the toggle button — replace the snapshot round-trip with the narrow action:
Now the page.tsx type passthrough:
Now the seed changes (FREESHIP type + stale comment S20-4):
检查其他可能受影响的 type 判断点：
三个测试断言需要校正（mock 细节 + 实际文案）。检查 `requireAdmin` 的真实返回：
**GREEN** — 受影响套件 107/107。运行完整单元套件 + lint + typecheck 确认无回归：
379/379 通过。修两个类型错误：
门禁全绿。现在 S20-1 e2e 加固 + S20-6 free-shipping e2e。先查种子价格区间和 success 页面渲染：
"French Rolling Pin & Baking Set"（$34.99）是 FREESHIP pin 的理想商品。读 shopping-flow 的 guest checkout 选择器以复用：
检查 cart-summary API 是否暴露 line id（用于精确的“恢复原状”清理）：
现在编写两个 E2E 变更 —— 加固 `admin-coupons` 规范并引入新的免费配送规范：
PATCH/DELETE 契约匹配。检查 coupon-box 的 applied 展示块以确定断言文本：
写 free-shipping e2e spec：
修正 spec 中的断言（FREESHIP chip 的渲染位置需要确认 — discount=0 时不渲染 Discount 行）：
修正 step-3 断言（FREESHIP 在复核卡片中的实际文案是 "Coupon FREESHIP — Free shipping"）：
刷新开发库的 FREESHIP 行为新类型（等价于 fresh-seed 契约），然后重建并运行 e2e：
Shell 把 `$30` 吃掉了，修正 description：
Toast 与 applied 块都渲染 "Free shipping" — 加 `.first()`：
Free-shipping spec 通过（cart label → checkout mirror → 服务器端 receipt 全链路）。运行完整 E2E 套件：
既有 flake（session-9 已知类别：toast 标题同时存在于 aria-live wrapper 中）——spec 首次到达该行。按套件既定约定加 `.first()`：
加固后的 spec 通过（含自愈 + 恢复清理）。验证 DB 状态证明“恢复原状”契约，然后跑完整套件：
DB 恢复原状（SESSION5 已清、购物车 x3 与 spec 运行前一致）。完整 E2E 套件：
**65/65 E2E 全绿**。最终门禁链确认：
门禁链全绿（379 unit · 65 e2e）。启动生产构建做手动浏览器验证：
验证窄 toggle 动作实时工作（切换两次，恢复原状）：
手动验证全部通过。关闭浏览器，刷新截图套件：
24 张截图刷新完毕。现在文档对齐 — 先修 AGENTS.md（S20-3 catch 计数 + 新不变量）：
AGENTS.md 主体更新完成。补充 S20-1 的 E2E 隔离经验到 process discipline 和 CLAUDE.md：
Now CLAUDE.md — lib list + coverage lists:
README.md 更新（badge 379/65 + 优惠券引擎描述 + 测试清单）：
PAD 更新（§8.1 lib 表 + §12 测试计数 + known-issues）：
SKILL.md 更新（v1.17.0 + project_state + Appendix B Session-20 条目）：
现在追加 Session-20 条目到 Appendix B（Session-19 条目之后、Appendix C 之前）：
DEPLOYMENT.md 漂移检查（预期无变化 — 无新 env var）：
DEPLOYMENT.md 无漂移（5 个 env var 全部文档化，无新增）。现在写运行叙事 `docs/session_33.md`：
Now update the worklog (Task 21 entry):
文档全部对齐。最终提交前审查变更集：
变更集干净（无 .env/db 泄漏、skills/ 未动）。读取推送技能文档：
推送流程已内化。验证 paramiko shim 与环境，然后提交：
paramiko 5.0.0 就绪。最终门禁 sanity 后提交：
提交完成（`a857949`）。执行推送流程 — key 物化 → 指纹校验 → dry-run → push：
Dry-run 确认 fast-forward（`9ed652d..a857949`）。执行真实推送：
推送成功并验证（remote main @ `a857949` == local HEAD，working tree clean，仅 main 分支，key 已粉碎）。更新工作区工作日志并收尾：
**Run 21（session-20 审计周期）完成并已推送** ✅ — 远程 `main` @ `a857949`，工作树干净，仅 main 分支。

**本轮执行摘要：**

1. **刷新与审阅** — 全新克隆 `9ed652d`；全部核心文档 + session_31/32 + REMEDIATION_PLAN + worklog 对照代码库验证（session-19 完成态确认）。环境影子路径通过显式 env 的首次 `db:push` + 既有符号链接收敛至同一 inode。

2. **门禁重验捕获一个真实失败** — `admin-coupons.spec.ts` 两次失败：对**持久化管理员购物车**的绝对 badge pin（Playwright actionability 重派发使 Add-to-Cart POST 双触发，badge "2"→"3"）+ 非幂等 setup（中止运行遗留 active SESSION5）。根因以 DB 证据确认 → S20-1。

3. **实时对照** — 参考站未变（用提供的凭据登录验证）；克隆站移动菜单（7 链接/导航自动关闭/Tailwind v4 条件挂载）、sitemap 25 个公开 URL、robots、JSON-LD、桌面视觉、零控制台错误全部通过。

4. **深度审计（21-a）** — session-19 修复全部 WIRED；**0 CRITICAL/HIGH/MEDIUM（连续第八轮）**；1 LOW 代码（toggle 快照回写丢失更新）+ 1 LOW 文档 + 2 NIT + 4 Informational。

5. **TDD 修复（RED 16 失败 → GREEN）** — 窄 `toggleCouponActiveAction`（只写 `isActive`）；**`free_shipping` 优惠券类型成为一等公民**（引擎 → 结账事务的 `isActive` 原子守卫 → 运费强制归零 → API/镜像/对话框/种子，贯穿服务器端收据 "FREE" 全链路 pin）；加固的 admin-coupons spec（API 播种 + 快照恢复 + 自愈）；E2E 持久状态隔离约定入档。

6. **最终状态** — 379/379 unit · 65/65 e2e · 全门禁绿；24 张截图刷新；8 份文档对齐（SKILL v1.17.0）。

**建议下一步：** 在 GitHub 上验证推送；延续的延期项（登录限速锁定权衡、真实邮件/OAuth/支付 epic — 受沙箱外部凭据限制）保持记录；优惠券引擎现已类型完备，邮件通知与 OAuth 仍是自然的下一增量。
