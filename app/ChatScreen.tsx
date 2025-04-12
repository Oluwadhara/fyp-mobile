// app/chat/index.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Constants from "expo-constants";

export default function ChatScreen() {
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);

  const apiKey = Constants.expoConfig?.extra?.groqApiKey;

  const detectEmotion = (text: string): string[] => {
    const lowered = text.toLowerCase();
    const emotions: string[] = [];

    if (/\b(sad|down|depressed|unhappy|cry|tired|worthless)\b/.test(lowered)) emotions.push("sadness");
    if (/\b(anxious|worried|nervous|scared|panic|overwhelmed)\b/.test(lowered)) emotions.push("anxiety");
    if (/\b(lonely|alone|isolated|abandoned)\b/.test(lowered)) emotions.push("loneliness");
    if (/\b(guilty|ashamed|blame|regret)\b/.test(lowered)) emotions.push("guilt");
    if (/\b(angry|frustrated|mad|annoyed)\b/.test(lowered)) emotions.push("anger");

    return emotions.length ? emotions : ["unknown"];
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = { text: inputText, from: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    let currentText = "";
    setMessages((prev) => [...prev, { text: currentText, from: "bot" }]);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages: [
            {
              role: "system",
              content:
                `You are a compassionate and emotionally intelligent AI mental health assistant. Your primary goal is to listen actively, understand the user's mental and emotional state, and respond with empathy, support, and encouragement.\n\n` +
                `You diagnose conditions or offer medical advice, but you help users process their emotions and recommend positive coping strategies or professional help when needed.\n\n` +
                `When appropriate, gently acknowledge detected emotions like sadness, anxiety, or loneliness. Use a kind, calm tone, and end responses with a short message of hope.`,
            },
            {
              role: "user",
              content: `User says: "${inputText}"\n\nDetected Emotion(s): ${detectEmotion(inputText).join(", ")}`,
            },
          ],
          temperature: 0.7,
        }),
      });

      const data = await res.json();
      const botReply = data.choices?.[0]?.message?.content?.trim();

      if (botReply) {
        const tokens = botReply.split(" "); // word-by-word
        for (let i = 0; i < tokens.length; i++) {
          currentText += (i > 0 ? " " : "") + tokens[i]; // add space between words
          await new Promise((resolve) => setTimeout(resolve, 225)); // 75ms per word
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: currentText, from: "bot" };
            return updated;
          });
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { text: "Sorry, no response from LLaMA.", from: "bot" },
        ]);
      }
    } catch (error) {
      console.error("Error talking to LLaMA:", error);
      setMessages((prev) => [
        ...prev,
        { text: "An error occurred. Please try again later.", from: "bot" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={80}
    >
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <View
            style={[
              styles.message,
              item.from === "user" ? styles.userMessage : styles.botMessage,
            ]}
          >
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={{ padding: 10 }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message"
          editable={!loading}
        />
        <Button title={loading ? "..." : "Send"} onPress={handleSend} disabled={loading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  message: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 4,
    maxWidth: "75%",
  },
  userMessage: {
    backgroundColor: "#DCF8C6",
    alignSelf: "flex-end",
  },
  botMessage: {
    backgroundColor: "#EAEAEA",
    alignSelf: "flex-start",
  },
  messageText: { fontSize: 16 },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    marginRight: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
  },
});
