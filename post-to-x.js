require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

async function postTweet(text) {
  try {
    const { data } = await client.v2.tweet(text);
    console.log("Posted:", `https://x.com/adlei_builds/status/${data.id}`);
  } catch (err) {
    console.error("Error:", err.data || err.message);
  }
}

// コマンドライン引数からテキストを取得、なければデフォルト
const text = process.argv[2] || "Hello from Claude Code!";
postTweet(text);
