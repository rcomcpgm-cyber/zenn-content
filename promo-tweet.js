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

const HISTORY_FILE = path.join(__dirname, "tweet-history.txt");

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

// プロモーション対象サービス
const SERVICES = [
  {
    name: "退去費用チェッカー",
    url: "https://taikyocheck.com",
    description: "退去費用の請求額を国交省ガイドライン基準と比較して過払いを診断するサービス",
    hashtags: "#退去費用 #引越し #賃貸",
    angles: [
      "退去費用が高すぎて納得いかない人向け",
      "敷金返還でぼったくられた経験",
      "国交省ガイドラインと実際の請求の差額",
      "退去時のハウスクリーニング代が相場より高い問題",
      "壁紙の張替え費用、本当にそんなにかかる？",
      "退去費用を払いすぎたかもしれない人へ",
      "引越しシーズンの退去トラブル",
      "過去5年以内の退去なら敷金返還請求できる",
    ],
  },
];

async function generatePromoTweet() {
  const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
  const angle = service.angles[Math.floor(Math.random() * service.angles.length)];

  const recentHistory = getHistory().slice(-10).join("\n");

  const prompt = `REONっていう30歳フリーランスITコンサルが、自分で作ったサービスを宣伝するツイートを1つ書いて。

## REONの口調
- 「〜かもです」「〜だなー」「〜ないね」「〜してえ」「草」くらいの柔らかさ
- 「です・ます」の丁寧語は使わないけど、「〜かもです」くらいのゆるい敬語はOK
- 押し売り感ゼロ。「作ったから使ってみて」くらいの軽さ

## 宣伝するサービス
- サービス名: ${service.name}
- URL: ${service.url}
- 内容: ${service.description}

## 切り口
「${angle}」の方向でツイートして。

## 絶対に守ること
- ツイート本文だけ出力。前置き・メタ情報は一切書くな
- 250文字以内
- URLは必ず含める: ${service.url}
- ハッシュタグは本文の最後に付ける: ${service.hashtags}
- 宣伝だけど押し売り感を出さない。体験談・問題提起・共感から入る
- 時間帯の表現を入れるな（「朝の〜」「深夜に〜」等）
- 「無料」「お得」「今だけ」みたいな煽り文句禁止

## いい例
「退去費用15万って言われたんだけど、ガイドライン基準で計算したら8万だった。差額7万て。作ったサービスで自分でも試してみたら結構えぐい結果出た ${service.url} ${service.hashtags}」

「引越しの時の退去費用、あれ言い値だからな。国交省のガイドラインと比較するサービス作ったから見てみて ${service.url} ${service.hashtags}」

## 最近のツイート（被り回避）
${recentHistory || "なし"}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  let tweetText = response.content[0].text.trim();
  tweetText = tweetText.replace(/^.{0,50}(ツイート|tweet)[：:]\s*/i, "");
  tweetText = tweetText.replace(/^[「『]|[」』]$/g, "");

  return tweetText;
}

async function main() {
  const tweetText = await generatePromoTweet();

  if (tweetText.length > 280) {
    console.log("Tweet too long, skipping:", tweetText);
    return;
  }

  // 重複チェック
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

  console.log(`Promo tweet: ${tweetText}`);

  const { data } = await twitter.v2.tweet(tweetText);
  console.log(`Posted: https://x.com/adlei_builds/status/${data.id}`);

  appendHistory(tweetText);
}

main().catch((err) => {
  console.error("Error:", err.data || err.message || err);
  process.exit(1);
});
