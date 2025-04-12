// app.config.ts
import "dotenv/config";

export default {
  expo: {
    name: "my-ai-chatbot",
    slug: "my-ai-chatbot",
    version: "1.0.0",
    sdkVersion: "52.0.0", // replace with your current Expo SDK
    android: {
      package: "com.dararocks.mentalhealthchatbot",
    },
    extra: {
      groqApiKey: "process.env.GROQ_API_KEY",
      eas: {
        projectId: "61120707-5eb5-4708-9de4-e301ea9e16b2"
      },
    },
    scheme: "my-ai-chatbot",
    experiments: {
      newArchEnabled: true,
    },
  },
};
