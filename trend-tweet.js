require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");
const Anthropic = require("@anthropic-ai/sdk");
const { TwitterApi } = require("twitter-api-v2");

const anthropic = new Anthropic();
const twitter = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const LOG_FILE = path.join(__dirname, "trend-tweet-log.json");

function getLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  } catch {
    return { tweets: [] };
  }
}

function saveLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

// X APIで今話題のAI/tech系ツイートを検索
async function findTrendingTopics() {
  const queries = [
    "(ChatGPT OR Claude OR Gemini OR OpenAI OR Anthropic) lang:ja -is:retweet",
    "(AI OR 生成AI OR LLM) (リリース OR 発表 OR アップデート OR 新機能) lang:ja -is:retweet",
    "(Cursor OR Copilot OR Claude Code OR Devin) lang:ja -is:retweet",
  ];

  const allTweets = [];
  for (const query of queries) {
    try {
      const result = await twitter.v2.search(query, {
        max_results: 20,
        "tweet.fields": "public_metrics,created_at,text",
      });
      if (result.data?.data) {
        allTweets.push(...result.data.data);
      }
    } catch (e) {
      console.log(`Search error for query: ${e.message || e}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // いいね数で並び替え、上位5件のテキストをまとめる
  const sorted = allTweets
    .sort(
      (a, b) =>
        (b.public_metrics?.like_count || 0) -
        (a.public_metrics?.like_count || 0)
    )
    .slice(0, 10);

  return sorted.map((t) => t.text).join("\n\n---\n\n");
}

async function generateTrendTweet(trendingContent) {
  const log = getLog();
  const recentTexts = log.tweets
    .slice(-10)
    .map((t) => t.text)
    .join("\n---\n");

  const prompt = `あなたは「REON」というXアカウントの中の人です。以下の「今X上で話題になっているAI/IT関連の投稿」を参考に、トレンドに乗ったツイートを1つ生成してください。

## あなたのプロフィール
- 高卒でIT業界12年目のフリーランスITコンサル
- Claude Codeで個人開発中（React Native/Expo/Supabase）
- 気さくでカジュアル。でも12年の経験に裏打ちされた視点がある

## 今話題のトピック
${trendingContent}

## ツイートのルール
- 200文字以内
- トレンドの話題に自分の経験や視点を絡める
- 「〜だと思うんだよね」「〜がヤバい」「〜は本質的に〜」のような、意見・考察系
- 単なるニュース紹介にしない。REONならではの切り口を入れる
- IT12年の実務経験からくるリアルな視点を活かす
- ハッシュタグは0〜1個
- 絵文字は0〜1個
- ツイート本文だけを出力

## 最近の投稿（被らないように）
${recentTexts || "（まだなし）"}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim().replace(/^[「『]|[」』]$/g, "");
}

async function main() {
  console.log("Searching for trending AI/IT topics...");
  const trendingContent = await findTrendingTopics();

  if (!trendingContent || trendingContent.trim().length < 20) {
    console.log("No trending content found, skipping.");
    return;
  }

  console.log("Generating trend tweet...");
  const tweetText = await generateTrendTweet(trendingContent);

  if (tweetText.length > 280) {
    console.log("Tweet too long, skipping:", tweetText);
    return;
  }

  console.log(`Tweet: ${tweetText}`);

  const { data } = await twitter.v2.tweet(tweetText);
  console.log(`Posted: https://x.com/adlei_builds/status/${data.id}`);

  const log = getLog();
  log.tweets.push({
    id: data.id,
    text: tweetText,
    postedAt: new Date().toISOString(),
  });

  if (log.tweets.length > 100) {
    log.tweets = log.tweets.slice(-100);
  }

  saveLog(log);
}

main().catch((err) => {
  console.error("Error:", err.data || err.message || err);
  process.exit(1);
});
