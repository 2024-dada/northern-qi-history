# 帝怒之后 · 北齐高氏暴力的事件与叙述

中国历史概论课程交互网页：从动作、事件与人物关系进入史料，对照多种叙述，逐步讨论原因的主次。

- 在线网站：https://2024-dada.github.io/northern-qi-history/
- 动态档案：https://2024-dada.github.io/northern-qi-history/#violence-gallery
- 项目仓库：https://github.com/2024-dada/northern-qi-history

## 当前版本

16幅融合动态档案、41条统一材料、约9分钟的四案引导主线。支持人物筛选、多关键词搜索、出处弹窗、慢放、暂停、重播与动画进度拖动。手机单列布局与阅读导航已优化。

网页动作、人物、服饰、器物及断离轨迹为美术示意；引文为原典录文初查，关键句影印、版本关系和学术解释仍须核验。不能将不同篇章直接拼成已证实的现场，也不作现代精神疾病诊断。

## 源码在哪里

网页10个文件直接放在仓库根目录。无需安装依赖或构建。

| 文件 | 用途 |
| --- | --- |
| index.html / styles.css | 页面结构与整站样式 |
| data.js | 原始事件、人物关系与出处 |
| app.js | 详情、搜索、筛选、阅读交互 |
| violence.js / violence.css | 原典事件动画及播放控制 |
| dossier.js / dossier.css | 文档线索融入统一材料及动画 |
| animation.js / animation.css | 斛律光案四幕引导动画 |

本地可在仓库目录执行 `python -m http.server 8766`，访问 http://127.0.0.1:8766/ 。也可直接打开index.html；对外分享用上面的公开网站。

## 如何获取2024-dada的更新

GitHub上的main是共享最新版。你看到主仓库已经更新，并不表示你的Fork或电脑文件自动更新。

### 使用自己的Fork（推荐用于提PR的协作者）

1. 打开你自己账号下的northern-qi-history仓库。
2. 在main分支点击 **Sync fork → Update branch**。如有冲突，按GitHub提示先处理，保留自己的修改。
3. 如果还在电脑上写代码，在本地项目目录运行：

```bash
git switch main
git pull --ff-only origin main
```

如果没有Git，可以在同步Fork后点击 **Code → Download ZIP** 下载最新版；先备份正在修改的文件，避免覆盖。

### 直接克隆主仓库的协作者

在本地项目目录运行：

```bash
git switch main
git pull --ff-only origin main
```

执行前先保存未提交的改动。出现冲突或提示不能快进时，不要强制覆盖，先检查本地改动和分支状态。

### GitHub Desktop

先切到main，点击 **Fetch origin**；有新提交时再点 **Pull origin**。如果origin是自己的Fork，先完成网页上的Sync fork。

## 如何把改动发给2024-dada

先同步最新版，再从main建立自己的功能分支，例如：

```bash
git switch -c improve-animation
```

改完后提交并推送该分支，在GitHub点击 **Compare & pull request**。确认：

- base repository：2024-dada/northern-qi-history
- base branch：main
- head：你修改后的分支

PR中简述改了什么，附截图、史料出处或检查结果。等待2024-dada审阅并合并。合并到main后GitHub Pages自动部署；部署完成才会在公开网站上看到变化。

每次开工前先同步main，避免用旧源码覆盖同伴修改；不要把改动直接覆盖到对方电脑。

## 如何得知有更新

打开主仓库 **Commits** 或 **Activity** 查看新提交。可以在Watch中订阅讨论、PR等通知，但通知不等于自动拉取源码，也不能保证每次普通push都发通知。

## 修改时的约定

保留出处编号、人物施事关系与不确定性说明。增加动画前核对材料；斩首、刺伤、受刑和死后处置分别呈现。代码修改后检查相应入口、移动布局与浏览器错误；更新资源版本避免缓存旧脚本。

GitHub官方说明：[同步Fork](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork)、[查看仓库活动](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/using-the-activity-view-to-see-changes-to-a-repository)。
