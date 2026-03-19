require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { TwitterApi } = require("twitter-api-v2");

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const PATTERNS_FILE = path.join(__dirname, "tweet-patterns.json");
const POSTED_FILE = path.join(__dirname, "posted-ids.json");

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

  // ランダムに1つ選ぶ
  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  try {
    const { data } = await client.v2.tweet(pick.text);
    console.log(`Posted [${pick.category} #${pick.id}]: https://x.com/adlei_builds/status/${data.id}`);

    postedIds.push(pick.id);
    savePostedIds(postedIds);
  } catch (err) {
    console.error("Error:", err.data || err.message);
    process.exit(1);
  }
}

const category = process.argv[2] || null;
postScheduled(category);
