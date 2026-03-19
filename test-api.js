require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

async function main() {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [{ role: "user", content: "こんにちは！一言で返事して" }],
  });
  console.log("API接続成功！");
  console.log("応答:", message.content[0].text);
}

main().catch((err) => {
  console.error("APIエラー:", err.message);
});
