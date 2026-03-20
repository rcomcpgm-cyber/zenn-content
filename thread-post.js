require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { TwitterApi } = require("twitter-api-v2");

const anthropic = new Anthropic();
const twitter = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const LOG_FILE = path.join(__dirname, "thread-log.json");
const ARTICLES_DIR = path.join(__dirname, "articles");

function getLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  } catch {
    return { threads: [] };
  }
}

function saveLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

function getPublishedArticles() {
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
  const articles = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf-8");
    if (content.includes("published: true")) {
      const titleMatch = content.match(/title:\s*"(.+?)"/);
      articles.push({
        file,
        title: titleMatch ? titleMatch[1] : file,
        content,
      });
    }
  }
  return articles;
}

async function generateThread(article) {
  const prompt = `以下のZenn技術記事をもとに、X（Twitter）のスレッド（連投ツイート）を作成してください。

## あなたのプロフィール
- REON。高卒でIT業界12年目のフリーランスITコンサル
- Claude Codeで個人開発中
- 気さくでカジュアル。知識はあるけど偉そうにしない

## 記事タイトル
${article.title}

## 記事本文
${article.content.substring(0, 3000)}

## スレッドのルール
- 1ツイート目: 強いフック（読みたくなる導入）。「スレッドで解説👇」的なのは禁止。自然に。
- 2〜5ツイート目: 記事の要点を凝縮。具体例やコード片があると良い
- 最後のツイート: 記事リンクへの自然な誘導
- 各ツイートは250文字以内
- ツイート間は「---」で区切る
- 合計5〜7ツイート
- ハッシュタグは最後のツイートに1〜2個だけ
- 絵文字は控えめ（各ツイート0〜1個）
- 宣伝臭を消す。価値提供が先
- 記事URLは最後のツイートに含めること: https://zenn.dev/and_and_and/articles/${article.file.replace(".md", "")}
- スレッド本文だけを出力。説明は不要`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const tweets = raw
    .split("---")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 280);

  return tweets;
}

async function postThread(tweets) {
  let previousTweetId = null;
  const postedIds = [];

  for (const text of tweets) {
    const params = previousTweetId
      ? { reply: { in_reply_to_tweet_id: previousTweetId } }
      : {};

    const { data } = await twitter.v2.tweet(text, params);
    postedIds.push(data.id);
    previousTweetId = data.id;
    console.log(`  Posted: ${text.substring(0, 60)}...`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  return postedIds;
}

async function main() {
  const log = getLog();
  const threadedFiles = new Set(log.threads.map((t) => t.file));
  const articles = getPublishedArticles();

  // まだスレッド化してない記事を1つ選ぶ
  const candidates = articles.filter((a) => !threadedFiles.has(a.file));

  if (candidates.length === 0) {
    console.log("All published articles already have threads.");
    return;
  }

  // ランダムに1つ選択
  const article = candidates[Math.floor(Math.random() * candidates.length)];
  console.log(`Generating thread for: ${article.title}`);

  const tweets = await generateThread(article);
  console.log(`Generated ${tweets.length} tweets`);

  if (tweets.length < 3) {
    console.log("Too few tweets generated, skipping.");
    return;
  }

  const tweetIds = await postThread(tweets);

  log.threads.push({
    file: article.file,
    title: article.title,
    tweetCount: tweetIds.length,
    firstTweetId: tweetIds[0],
    postedAt: new Date().toISOString(),
  });

  saveLog(log);
  console.log(
    `\nThread posted: https://x.com/adlei_builds/status/${tweetIds[0]}`
  );
}

main().catch((err) => {
  console.error("Error:", err.data || err.message || err);
  process.exit(1);
});
