require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { TwitterApi } = require("twitter-api-v2");

const twitter = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const ANALYTICS_FILE = path.join(__dirname, "analytics-log.json");
const MY_ID = "2034683226716057600";

function getLog() {
  try {
    return JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf-8"));
  } catch {
    return { weeks: [] };
  }
}

function saveLog(data) {
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
}

async function collectAnalytics() {
  // 自分のプロフィール情報
  const me = await twitter.v2.me({
    "user.fields": "public_metrics,description",
  });
  const metrics = me.data.public_metrics;

  console.log(`Followers: ${metrics.followers_count}`);
  console.log(`Following: ${metrics.following_count}`);
  console.log(`Total tweets: ${metrics.tweet_count}`);

  // 直近のツイートを取得（パフォーマンス分析）
  const timeline = await twitter.v2.userTimeline(MY_ID, {
    max_results: 50,
    "tweet.fields": "public_metrics,created_at,text",
  });

  const tweets = timeline.data?.data || [];
  let totalLikes = 0;
  let totalRetweets = 0;
  let totalImpressions = 0;
  let topTweets = [];

  for (const t of tweets) {
    const pm = t.public_metrics || {};
    totalLikes += pm.like_count || 0;
    totalRetweets += pm.retweet_count || 0;
    totalImpressions += pm.impression_count || 0;
    topTweets.push({
      text: t.text.substring(0, 80),
      likes: pm.like_count || 0,
      retweets: pm.retweet_count || 0,
      impressions: pm.impression_count || 0,
      date: t.created_at,
    });
  }

  // いいね数でソートしてトップ5を取得
  topTweets.sort((a, b) => b.likes - a.likes);
  const top5 = topTweets.slice(0, 5);

  const report = {
    date: new Date().toISOString(),
    profile: {
      followers: metrics.followers_count,
      following: metrics.following_count,
      totalTweets: metrics.tweet_count,
    },
    last50Tweets: {
      totalLikes,
      totalRetweets,
      totalImpressions,
      avgLikes: (totalLikes / tweets.length).toFixed(1),
      avgImpressions: (totalImpressions / tweets.length).toFixed(1),
      tweetCount: tweets.length,
    },
    topTweets: top5,
  };

  // 前週との比較
  const log = getLog();
  if (log.weeks.length > 0) {
    const prev = log.weeks[log.weeks.length - 1];
    const followerGrowth =
      report.profile.followers - prev.profile.followers;
    const impressionChange =
      report.last50Tweets.totalImpressions - prev.last50Tweets.totalImpressions;

    report.growth = {
      followers: followerGrowth,
      followersPercent: (
        (followerGrowth / Math.max(prev.profile.followers, 1)) *
        100
      ).toFixed(1),
      impressionChange,
    };

    console.log(`\n--- Growth ---`);
    console.log(`Follower growth: +${followerGrowth} (${report.growth.followersPercent}%)`);
    console.log(`Impression change: ${impressionChange > 0 ? "+" : ""}${impressionChange}`);
  }

  console.log(`\n--- Top 5 Tweets ---`);
  for (const t of top5) {
    console.log(
      `  ${t.likes} likes | ${t.impressions} imp | ${t.text}...`
    );
  }

  console.log(`\n--- Summary ---`);
  console.log(`Avg likes/tweet: ${report.last50Tweets.avgLikes}`);
  console.log(`Avg impressions/tweet: ${report.last50Tweets.avgImpressions}`);

  log.weeks.push(report);
  // 直近12週分だけ保持
  if (log.weeks.length > 12) {
    log.weeks = log.weeks.slice(-12);
  }
  saveLog(log);

  console.log("\nAnalytics saved.");
}

collectAnalytics().catch((err) => {
  console.error("Error:", err.data || err.message || err);
  process.exit(1);
});
