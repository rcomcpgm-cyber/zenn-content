require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { TwitterApi } = require("twitter-api-v2");

const anthropic = new Anthropic();
const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const PATTERNS_FILE = path.join(__dirname, "tweet-patterns.json");
const POSTED_FILE = path.join(__dirname, "posted-ids.json");
const HISTORY_FILE = path.join(__dirname, "tweet-history.txt");

function getPostedIds() {
  try {
    return JSON.parse(fs.readFileSync(POSTED_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function savePostedIds(ids) {
  fs.writeFileSync(POSTED_FILE, JSON.stringify(ids, null, 2));
}

function getHistory() {
  try {
    return fs.readFileSync(HISTORY_FILE, "utf-8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function appendHistory(text) {
  fs.appendFileSync(HISTORY_FILE, text + "\n");
}

async function rewriteWithClaude(original, category) {
  const prompt = `以下の元ネタを、REONっていう30歳フリーランスITコンサルの口調でリライトして。

## 元ネタ
${original}

## REONの口調
- 高卒IT12年の叩き上げ。フリーランスコンサル
- 「〜かもです」「〜だなー」「〜ないね」「〜してえ」「草」くらいの柔らかさ
- 「〜アカンのや」「〜やん」みたいな強い方言は控える
- メインアカウントより少しだけ硬め。ビジネス垢なので

## 人間っぽく書くコツ
- 途中で文が切れてもいい。全部説明しなくていい
- 具体的な固有名詞・数字を入れる
- 感情は1個だけ。「嬉しい」「だるい」「やばい」どれか1つ
- 文末のバリエーション：「〜だわ」「〜なんだが」「〜かもです」「〜してえ」「草」「〜だなー」

## 絶対に守ること
- ツイート本文だけを出力。前置き・説明・メタ情報は一切書くな
- 140文字以内。短いほどいい。10〜50文字がベスト
- ハッシュタグ禁止
- 絵文字は0〜1個。なくていい
- 考察・教訓・まとめ禁止。オチをつけるな
- 宣伝禁止。リンク禁止
- 元ネタの内容を踏まえつつ、自分の体験っぽく書き直す
- 「〜しよう」「〜しましょう」みたいな呼びかけ禁止

## ダメな例
「CLAUDE.mdを書くのがClaude Code活用の第一歩。」→ 元ネタそのまま。リライトになってない
「Claude Codeを使う時はCLAUDE.mdを書いておくと便利ですよ！」→ 丁寧語+呼びかけ。AI感

## いい例
「CLAUDE.mdちゃんと書いたらClaude Codeの精度マジで変わった」
「/compact知らなくてトークン無駄遣いしてたわ」
「案件の単価、時給換算するとだるくなるからやめた」`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim().replace(/^[「『]|[」』]$/g, "");
}

async function postScheduled(category) {
  const patterns = JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8"));
  const postedIds = getPostedIds();

  // カテゴリでフィルタ（指定なしなら全部）
  let candidates = category
    ? patterns.filter((p) => p.category === category && !postedIds.includes(p.id))
    : patterns.filter((p) => !postedIds.includes(p.id));

  if (candidates.length === 0) {
    // 全部投稿済みならリセット
    console.log("All patterns posted. Resetting...");
    savePostedIds([]);
    candidates = category
      ? patterns.filter((p) => p.category === category)
      : patterns;
  }

  if (candidates.length === 0) {
    console.log(`No patterns found for category "${category}". Skipping.`);
    return;
  }

  // ランダムに1つ選ぶ
  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  // Claude APIでREONの口調にリライト
  let tweetText = await rewriteWithClaude(pick.text, pick.category);

  // 前置き除去
  tweetText = tweetText.replace(/^.{0,50}(ツイート|tweet)[：:]\s*/i, "");
  tweetText = tweetText.replace(/^[「『]|[」』]$/g, "");

  if (tweetText.length > 280) {
    console.log("Rewritten tweet too long, skipping:", tweetText);
    return;
  }

  // 全履歴と重複チェック
  const history = getHistory();
  const isDuplicate = history.some((past) => {
    if (past === tweetText) return true;
    const shorter = Math.min(past.length, tweetText.length);
    if (shorter === 0) return false;
    let match = 0;
    for (let i = 0; i < shorter; i++) {
      if (past[i] === tweetText[i]) match++;
    }
    return match / shorter > 0.8;
  });

  if (isDuplicate) {
    console.log("Duplicate tweet detected, skipping:", tweetText);
    return;
  }

  console.log(`Original [${pick.category} #${pick.id}]: ${pick.text}`);
  console.log(`Rewritten: ${tweetText}`);

  const { data } = await client.v2.tweet(tweetText);
  console.log(`Posted: https://x.com/adlei_builds/status/${data.id}`);

  // 全履歴に追記
  appendHistory(tweetText);

  postedIds.push(pick.id);
  savePostedIds(postedIds);
}

const category = process.argv[2] || null;
postScheduled(category).catch((err) => {
  console.error("Error:", err.data || err.message || err);
  process.exit(1);
});
