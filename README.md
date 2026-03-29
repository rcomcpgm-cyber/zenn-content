# zenn-content

Zenn 技術記事の管理 + X（Twitter）自動運用の統合リポジトリ。
GitHub 連携で push すると Zenn に自動反映され、GitHub Actions の cron で X の自動投稿・エンゲージメント・分析が回る。

## 技術スタック

| 技術 | 用途 |
|------|------|
| Node.js (CommonJS) | 全スクリプトの実行環境 |
| [twitter-api-v2](https://www.npmjs.com/package/twitter-api-v2) | X API 操作（投稿・検索・いいね・フォロー） |
| [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) | Claude Haiku によるツイート生成・記事リライト |
| [Zenn CLI](https://zenn.dev/zenn/articles/install-zenn-cli) | 記事・本の管理 |
| GitHub Actions | cron による全自動化 |

## ディレクトリ構成

```
zenn-content/
├── articles/                  # Zenn 記事（31本）
├── books/                     # Zenn 本
├── .github/workflows/         # GitHub Actions ワークフロー（10本）
│
├── casual-tweet.js            # AI 生成カジュアルツイート
├── scheduled-post.js          # パターン DB からの定型投稿
├── trend-tweet.js             # トレンド反応ツイート
├── auto-reply.js              # いいね + フォロー自動化
├── auto-unfollow.js           # フォロバなしユーザーの自動アンフォロー
├── analyze-influencers.js     # インフルエンサー分析
├── weekly-analytics.js        # 週次アカウント分析
├── thread-post.js             # 記事 → スレッド変換
├── qiita-crosspost.js         # Zenn 記事 → Qiita リライト投稿
├── generate-tweet.js          # 記事公開時のツイート生成
├── post-to-x.js               # X 投稿実行
│
├── tweet-patterns.json        # ツイートパターン DB（780パターン）
├── influencer-patterns.json   # インフルエンサー分析結果
├── casual-tweet-log.json      # カジュアルツイート履歴
├── trend-tweet-log.json       # トレンドツイート履歴
├── auto-reply-log.json        # いいね履歴
├── followed-users.json        # フォロー済みユーザー
├── posted-ids.json            # パターン投稿済み ID
├── thread-log.json            # スレッド投稿履歴
├── qiita-crosspost-log.json   # Qiita クロスポスト履歴
├── analytics-log.json         # 週次分析データ
└── tweet-history.txt          # ツイート重複チェック用テキスト
```

## 機能一覧

### 1. ツイート自動投稿（3種類）

#### casual-tweet.js — AI 生成カジュアルツイート

Claude Haiku で REON のペルソナに基づくツイートを生成・投稿する。

- 時間帯別トピックプール（朝 / 昼 / 午後 / 夜 / 深夜）
- インフルエンサー分析結果をプロンプトに注入
- 過去ツイートとの重複チェック（類似度判定）
- 140 文字以内、10〜50 文字がベスト

#### scheduled-post.js — パターン DB からの定型投稿

`tweet-patterns.json`（780 パターン）から未投稿のパターンをランダム選択し、Claude でリライトして投稿。

- カテゴリ: tips / mindset / learning / article / devlog / industry / engagement
- 時間帯に応じてカテゴリを自動選択（昼: 実用系、夕方: 業界系、夜: 共感系）

#### trend-tweet.js — トレンド反応ツイート

X 検索で AI / テック系の話題ツイートを取得し、Claude Haiku で「REON の感想」として投稿。

- インフルエンサー分析結果をプロンプトに注入
- 検索クエリのローテーション

### 2. エンゲージメント自動化

#### auto-reply.js — いいね + フォロー

ツイート検索 → フォロバ率ソート → いいね → フォロー の自動化。

| 設定 | 値 |
|------|-----|
| 1 回の上限 | 10 件 |
| 日あたり最大 | 20 いいね / 20 フォロー |
| フォロワー下限 | 10 人未満は除外 |
| ソート基準 | フォロー / フォロワー比が 1.0 に近い順 |
| 重複排除 | `auto-reply-log.json` / `followed-users.json` |

検索クエリ例: `Claude Code lang:ja`, `エンジニア 個人開発 lang:ja`, `AI コーディング lang:ja` など 10 個をローテーション。

#### auto-unfollow.js — 自動アンフォロー

一定期間フォロバされなかったユーザーを自動アンフォロー。

### 3. 記事連携

#### auto-publish.yml — Zenn 記事の自動公開 + X 告知

未公開の Zenn 記事を `publish_order` 順に 1 つ公開し、X に告知ツイートを投稿。

- `generate-tweet.js` で記事タイトルからツイート文面を生成
- `post-to-x.js` で X に投稿

#### qiita-crosspost.js — Qiita クロスポスト

公開済み Zenn 記事を Claude API でリライトし、Qiita に投稿。

#### thread-post.js — 記事 → スレッド変換

公開済み記事を Claude API で 3〜6 ツイートのスレッドに変換して投稿。

### 4. 分析

#### analyze-influencers.js — インフルエンサー分析

IT 系エンジニア・経営者のツイートを分析し、高 / 低エンゲージメントのパターン・文体・話題選びのコツを抽出。

- 分析対象: kensuu, masason, mizchi, shi3z, からあげ 等
- `from:username` 検索で直近 7 日分を取得
- 結果は `casual-tweet.js` と `trend-tweet.js` のプロンプトに自動注入

#### weekly-analytics.js — 週次アカウント分析

フォロワー数・インプレッション・エンゲージメント率などを集計し、`analytics-log.json` に 12 週分保持。

## スケジュール一覧（JST）

| 時刻 | ワークフロー | スクリプト | 内容 |
|------|-------------|-----------|------|
| 07:30 | scheduled-tweets | scheduled-post.js | tips / learning パターン投稿 |
| 08:00 | casual-tweets | casual-tweet.js | AI 生成カジュアルツイート |
| 10:00 | auto-publish | generate-tweet.js + post-to-x.js | Zenn 記事公開 + X 告知 |
| 12:00 | casual-tweets | casual-tweet.js | AI 生成カジュアルツイート |
| 12:15 | scheduled-tweets | scheduled-post.js | article / industry パターン投稿 |
| 12:30 | auto-reply | auto-reply.js | いいね + フォロー（1 回目） |
| 13:00 | trend-tweet | trend-tweet.js | トレンド反応ツイート |
| 14:00 | qiita-crosspost | qiita-crosspost.js | Qiita リライト投稿 |
| 15:00 | auto-unfollow | auto-unfollow.js | フォロバなしアンフォロー |
| 19:00 | scheduled-tweets | scheduled-post.js | mindset / devlog パターン投稿 |
| 19:30 | casual-tweets | casual-tweet.js | AI 生成カジュアルツイート |
| 20:00 水・土 | thread-post | thread-post.js | 記事 → スレッド |
| 20:30 | trend-tweet | trend-tweet.js | トレンド反応ツイート |
| 21:00 | auto-reply | auto-reply.js | いいね + フォロー（2 回目） |
| 月曜 10:00 | analyze-influencers | analyze-influencers.js | インフルエンサー分析 |
| 日曜 10:00 | weekly-analytics | weekly-analytics.js | 週次アカウント分析 |

## データファイル

| ファイル | 用途 | 保持件数 |
|---------|------|---------|
| `auto-reply-log.json` | いいね履歴 | 500 件 |
| `followed-users.json` | フォロー済みユーザー | 無制限 |
| `casual-tweet-log.json` | カジュアルツイート履歴 | 100 件 |
| `trend-tweet-log.json` | トレンドツイート履歴 | 100 件 |
| `posted-ids.json` | パターン投稿済み ID | 全件（リセットあり） |
| `thread-log.json` | スレッド投稿履歴 | 全件 |
| `qiita-crosspost-log.json` | Qiita クロスポスト履歴 | 全件 |
| `analytics-log.json` | 週次アカウント分析 | 12 週分 |
| `influencer-patterns.json` | インフルエンサー分析結果 | 5 回分 |
| `tweet-patterns.json` | ツイートパターン DB | 全件（780 パターン） |

## REON ペルソナ設定

ツイート生成で使用する共通ペルソナ。

- 30 歳フリーランス IT コンサル、高卒 IT 12 年の叩き上げ
- Claude Code で個人開発、酒好き、アニメ・F1 観戦
- 口調：「〜だなー」「〜かもです」「〜ないね」「草」程度の柔らかさ
- 禁止：ハッシュタグ、過度な絵文字、評論家口調、宣伝、天気の話

## GitHub Actions Secrets（必須）

| シークレット名 | 利用スクリプト |
|---------------|--------------|
| `X_API_KEY` | 全 X 系スクリプト |
| `X_API_SECRET` | 全 X 系スクリプト |
| `X_ACCESS_TOKEN` | 全 X 系スクリプト |
| `X_ACCESS_SECRET` | 全 X 系スクリプト |
| `ANTHROPIC_API_KEY` | AI 生成系（casual, trend, thread, qiita, influencer） |
| `QIITA_TOKEN` | qiita-crosspost.js |

## セットアップ

```bash
npm ci
cp .env.example .env  # ローカル実行時のみ
```

## 関連リンク

- X アカウント: [@adlei_builds](https://x.com/adlei_builds)
- Zenn: [zenn.dev/rcn_article](https://zenn.dev/rcn_article)
