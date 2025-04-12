// app.config.ts
import "dotenv/config";

export default {
  expo: {
    name: "my-ai-chatbot",
    slug: "my-ai-chatbot",
    version: "1.0.0",
    sdkVersion: "52.0.0", // replace with your current Expo SDK
    extra: {
      groqApiKey: process.env.GROQ_API_KEY,
    },
    scheme: "my-ai-chatbot",
    experiments: {
      newArchEnabled: true,
    },
  },
};
