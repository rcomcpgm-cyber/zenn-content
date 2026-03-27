/**
 * 献立ガチャ自動ツイート
 * モックDBからランダムに3品選んでツイート
 * GitHub Actions cronで毎日12:00/18:00 JSTに実行
 */
const { TwitterApi } = require("twitter-api-v2");
const fs = require("fs");
const path = require("path");

// レシピDBをインラインで定義（kondate/src/data/recipes.tsから主要データのみ抽出）
const RECIPES = [
  { name: "鶏の照り焼き", genre: "和食", calories: 350, time: 20, rarity: "N" },
  { name: "豚の生姜焼き", genre: "和食", calories: 380, time: 15, rarity: "N" },
  { name: "味噌汁", genre: "和食", calories: 60, time: 10, rarity: "N" },
  { name: "和風ハンバーグ", genre: "和食", calories: 420, time: 30, rarity: "R" },
  { name: "麻婆豆腐", genre: "中華", calories: 280, time: 20, rarity: "R" },
  { name: "エビチリ", genre: "中華", calories: 250, time: 20, rarity: "SR" },
  { name: "カルボナーラ", genre: "洋食", calories: 550, time: 20, rarity: "R" },
  { name: "チキン南蛮", genre: "和食", calories: 480, time: 30, rarity: "R" },
  { name: "回鍋肉", genre: "中華", calories: 320, time: 15, rarity: "N" },
  { name: "肉じゃが", genre: "和食", calories: 280, time: 30, rarity: "N" },
  { name: "餃子", genre: "中華", calories: 300, time: 40, rarity: "R" },
  { name: "ビーフシチュー", genre: "洋食", calories: 450, time: 60, rarity: "SR" },
  { name: "鯖の味噌煮", genre: "和食", calories: 280, time: 25, rarity: "R" },
  { name: "グリーンカレー", genre: "エスニック", calories: 400, time: 25, rarity: "SR" },
  { name: "ローストビーフ", genre: "洋食", calories: 380, time: 90, rarity: "SR" },
  { name: "フォアグラ丼", genre: "フレンチ", calories: 520, time: 15, rarity: "SSR" },
];

// 副菜リスト（ランダム選択用）
const SIDES = [
  { name: "ほうれん草のおひたし", calories: 30, rarity: "N" },
  { name: "きんぴらごぼう", calories: 80, rarity: "N" },
  { name: "ポテトサラダ", calories: 150, rarity: "N" },
  { name: "冷奴", calories: 60, rarity: "N" },
  { name: "たまご焼き", calories: 120, rarity: "N" },
  { name: "切り干し大根", calories: 50, rarity: "N" },
  { name: "なすの煮浸し", calories: 40, rarity: "R" },
  { name: "明太子ポテサラ", calories: 180, rarity: "R" },
  { name: "アボカドサラダ", calories: 160, rarity: "R" },
  { name: "カプレーゼ", calories: 140, rarity: "SR" },
];

// 汁物リスト
const SOUPS = [
  { name: "味噌汁", calories: 60, rarity: "N" },
  { name: "けんちん汁", calories: 80, rarity: "N" },
  { name: "わかめスープ", calories: 30, rarity: "N" },
  { name: "コーンスープ", calories: 120, rarity: "N" },
  { name: "豚汁", calories: 120, rarity: "R" },
  { name: "ミネストローネ", calories: 90, rarity: "R" },
  { name: "クラムチャウダー", calories: 180, rarity: "SR" },
  { name: "参鶏湯風スープ", calories: 200, rarity: "SR" },
];

const RARITY_EMOJI = { N: "", R: "✨", SR: "🌟", SSR: "👑" };
const RARITY_STAR = { N: "★", R: "★★", SR: "★★★", SSR: "★★★★" };

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// レアリティの確率に基づいてフィルタリング（SSRは低確率で出現）
function pickWeighted(arr) {
  const weights = { N: 45, R: 30, SR: 18, SSR: 7 };
  const roll = Math.random() * 100;
  let target;
  if (roll < weights.SSR) target = "SSR";
  else if (roll < weights.SSR + weights.SR) target = "SR";
  else if (roll < weights.SSR + weights.SR + weights.R) target = "R";
  else target = "N";

  const filtered = arr.filter((r) => r.rarity === target);
  return filtered.length > 0 ? pick(filtered) : pick(arr);
}

// ツイート履歴の重複回避
const LOG_FILE = path.join(__dirname, "kondate-tweet-log.json");
function loadLog() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8")); }
  catch { return []; }
}
function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log.slice(-50), null, 2));
}

async function main() {
  const main = pickWeighted(RECIPES);
  const side = pickWeighted(SIDES);
  const soup = pickWeighted(SOUPS);

  const totalCalories = main.calories + side.calories + soup.calories;
  const totalTime = main.time + 10; // 副菜・汁物は並行調理想定

  const hasSSR = [main, side, soup].some((r) => r.rarity === "SSR");
  const hasSR = [main, side, soup].some((r) => r.rarity === "SR");

  let header = "🎰 今日の献立ガチャ結果！";
  if (hasSSR) header = "🎉 SSR降臨！！今日の献立ガチャ結果！";
  else if (hasSR) header = "✨ SR出た！今日の献立ガチャ結果！";

  const tweet = `${header}

🍖 主菜：${main.name}【${main.rarity}】${RARITY_EMOJI[main.rarity]}
🥗 副菜：${side.name}【${side.rarity}】${RARITY_EMOJI[side.rarity]}
🍜 汁物：${soup.name}【${soup.rarity}】${RARITY_EMOJI[soup.rarity]}

📊 合計 ${totalCalories}kcal ⏱️ ${totalTime}分

▶ https://kondate-nu.vercel.app`;

  console.log("--- ツイート内容 ---");
  console.log(tweet);
  console.log(`--- ${tweet.length}文字 ---`);

  if (tweet.length > 280) {
    console.log("⚠️ 280文字超過、スキップ");
    return;
  }

  // 重複チェック
  const log = loadLog();
  const key = `${main.name}-${side.name}-${soup.name}`;
  if (log.includes(key)) {
    console.log("⚠️ 同じ組み合わせが直近にあるためスキップ");
    return;
  }

  // 投稿
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });

  const { data } = await client.v2.tweet(tweet);
  console.log(`✅ 投稿完了: https://x.com/adlei_builds/status/${data.id}`);

  log.push(key);
  saveLog(log);
}

main().catch((e) => {
  console.error("❌ エラー:", e.message);
  process.exit(1);
});
