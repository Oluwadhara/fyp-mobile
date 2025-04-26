// app/chat/ChatScreen.tsx 348ln
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from 'expo-clipboard';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useFocusEffect } from "@react-navigation/native";
import { useEffect, useCallback } from "react";
import Toast from 'react-native-toast-message';
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import axios from "axios";

type MessageType = {
  text: string;
  from: "user" | "bot";
  timestamp: string;         // for display (HH:MM)
  createdAt?: any;           // Firestore timestamp, for ordering
  userId: string;
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const apiKey = "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";
  const userId = "defaultUser";  // replace with real user once auth is in place

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'saving'>('idle');

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const STORAGE_KEY = `@chat_messages_${userId}`;

  const saveMessagesToStorage = async (msgs: MessageType[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
      console.log("💾 Messages saved to AsyncStorage");
    } catch (e) {
      console.error("❌ Failed to save messages:", e);
    }
  };

  const loadMessagesFromStorage = async (): Promise<MessageType[]> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: MessageType[] = JSON.parse(stored);
        console.log("📦 Loaded messages from AsyncStorage");
        return parsed;
      }
    } catch (e) {
      console.error("❌ Failed to load from AsyncStorage:", e);
    }
    return [];
  };


  const detectEmotion = (text: string): string[] => {
    const l = text.toLowerCase();
    const e: string[] = [];
    if (/\b(sad|down|depressed)\b/.test(l)) e.push("sadness");
    if (/\b(anxious|worried|nervous)\b/.test(l)) e.push("anxiety");
    if (/\b(lonely|alone)\b/.test(l)) e.push("loneliness");
    if (/\b(guilty|ashamed)\b/.test(l)) e.push("guilt");
    if (/\b(angry|mad)\b/.test(l)) e.push("anger");
    return e.length ? e : ["unknown"];
  };

  const getTimestamp = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Load from Firestore whenever the screen is focused
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const localMsgs = await loadMessagesFromStorage();
        if (localMsgs.length > 0) {
          setMessages(localMsgs);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 1000);
        }

        try {
          const q = query(
            collection(db, "chatMessages"),
            where("userId", "==", userId),
            orderBy("createdAt", "asc")
          );
          const snap = await getDocs(q);
          const loaded: MessageType[] = snap.docs.map((doc) => {
            const data = doc.data() as any;
            return {
              text: data.text,
              from: data.from,
              timestamp: new Date(data.createdAt.toDate()).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              createdAt: data.createdAt,
              userId: data.userId,
            };
          });

          setMessages(loaded);
          saveMessagesToStorage(loaded); // 🧠 Save updated list to local storage

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 1000);

          console.log("🟢 Loaded messages from Firestore");
        } catch (e) {
          console.error("🔴 Failed to load from Firestore:", e);
        }
      })();
    }, [])
  );

  // Save to Firestore
  const saveMessageToFirebase = async (msg: MessageType) => {
    try {
      await addDoc(collection(db, "chatMessages"), {
        text: msg.text,
        from: msg.from,
        userId: msg.userId,
        createdAt: serverTimestamp(),
      });
      console.log("🟢 Saved message to Firebase:", msg);
    } catch (e) {
      console.error("🔴 Firebase save failed:", e);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setRecordingStatus('recording');
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording:", err);
      Toast.show({ type: 'error', text1: 'Recording failed to start' });
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setRecordingStatus("saving");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      console.log("Recording stopped");
      if (!uri) return;

      const fileName = uri.split("/").pop()!;
      const blob = await (await fetch(uri)).blob();

      const storageRef = ref(getStorage(), `audio/${fileName}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      console.log(downloadURL);

      transcribeAudio(downloadURL);
    } catch (err) {
      console.error("Error stopping or uploading recording:", err);
      Toast.show({ type: 'error', text1: 'Error saving recording' });
    }
    setRecordingStatus("idle");
  };

  const transcribeAudio = async (audioUrl: string) => {
    console.log("Transcribing Audio");

    try {
      const res = await axios.post(
        "https://api.assemblyai.com/v2/transcript",
        {
          audio_url: audioUrl,
          sentiment_analysis: true,
        },
        {
          headers: {
            authorization: "1508c41adf824af680f5e97397907cd4", // 🔐 Use env vars in prod
            "content-type": "application/json",
          },
        }
      );

      const transcriptId = res.data.id;

      const poll = async () => {
        const statusRes = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          { headers: { authorization: "1508c41adf824af680f5e97397907cd4" } }
        );

        if (statusRes.data.status === "completed") {
          const text = statusRes.data.text;
          const emotionResult = detectEmotion(text);

          console.log("Transcription result: ");
          console.log(text);
          console.log(emotionResult);

          handleSend(text);

        } else if (statusRes.data.status === "failed") {
          Toast.show({ type: 'error', text1: 'Transcription failed' });
        } else {
          setTimeout(poll, 2000);
        }
      };

      setTimeout(poll, 2000);
    } catch (e) {
      console.error("Error transcribing:", e);
      Toast.show({ type: 'error', text1: 'Transcription request failed' });
    }
  };

  const handleSend = async (text?: string) => {
    const finalText = text?.trim() ?? inputText.trim();
    if (!finalText) return;

    setError("");

    const userMsg: MessageType = {
      text: finalText,
      from: "user",
      timestamp: getTimestamp(),
      userId,
    };

    setMessages((prev) => [...prev, userMsg]);
    saveMessageToFirebase(userMsg);
    setInputText("");
    setLoading(true);

    const typingMsg: MessageType = {
      text: "Typing…",
      from: "bot",
      timestamp: getTimestamp(),
      userId,
    };

    setMessages((prev) => [...prev, typingMsg]);

    let botReply = "";
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
              content: "You are a compassionate AI mental health assistant…",
            },
            {
              role: "user",
              content: `User says: "${finalText}"\nDetected Emotion(s): ${detectEmotion(
                finalText
              ).join(", ")}`,
            },
          ],
          temperature: 0.7,
        }),
      });

      const data = await res.json();
      botReply = data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) {
      console.error("Error fetching bot reply:", e);
      setError("Failed to get response. Try again.");
    }

    setMessages((prev) => prev.slice(0, -1)); // Remove typing

    if (botReply) {
      const tokens = botReply.split(" ");
      let acc = "";
      const botMsg: MessageType = {
        text: "",
        from: "bot",
        timestamp: getTimestamp(),
        userId,
      };
      setMessages((prev) => [...prev, botMsg]);

      for (let i = 0; i < tokens.length; i++) {
        acc += (i > 0 ? " " : "") + tokens[i];
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1].text = acc;
          return copy;
        });
        await new Promise((r) => setTimeout(r, 75));
      }

      saveMessageToFirebase({
        text: acc,
        from: "bot",
        timestamp: getTimestamp(),
        userId,
      });
    } else {
      const errMsg: MessageType = {
        text: "Sorry, no response from the AI.",
        from: "bot",
        timestamp: getTimestamp(),
        userId,
      };
      setMessages((prev) => {
        const updated = [...prev, userMsg];
        saveMessagesToStorage(updated);
        return updated;
      });
      saveMessageToFirebase(errMsg);
    }

    setLoading(false);
  };

  const renderMessage = ({
    item,
    index,
  }: {
    item: MessageType;
    index: number;
  }) => {
    const isUser = item.from === "user";
    const sameAsBefore =
      index > 0 && messages[index - 1].from === item.from;

    return (
      <TouchableOpacity
        onLongPress={() =>
          Alert.alert("Copy text?", "", [
            {
              text: "Copy",
              onPress: () => {
                Clipboard.setStringAsync(item.text);
                Toast.show({
                  type: 'success',
                  text1: 'Copied text!',
                });
              },
            },
            // {
            //   text: "Delete",
            //   onPress: () =>
            //     setMessages((prev) => {
            //       const filtered = prev.filter((_, i) => i !== index);
            //       saveMessagesToStorage(filtered); // update storage
            //       return filtered;
            //     }),
            //   style: "destructive",
            // },
            { text: "Cancel", style: "cancel" },
          ])
        }
      >
        <View
          style={[
            styles.msgContainer,
            isUser ? styles.user : styles.bot,
            isUser ? styles.userBubble : styles.botBubble,
          ]}
        >
          {!sameAsBefore && (
            <Text style={styles.senderLabel}>
              {isUser ? "You" : "Assistant"}
            </Text>
          )}
          <View style={styles.bubble}>
            <Text style={styles.text}>{item.text}</Text>
            <Text style={styles.ts}>{item.timestamp}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={80}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={{ padding: 12 }}
      />

      {loading && (
        <View style={styles.typing}>
          <ActivityIndicator size="small" color="#666" />
          <Text style={styles.typingText}>Waiting for response…</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 8 }}>
          <TouchableOpacity
            style={{
              backgroundColor: recordingStatus === "recording" ? "#FF5555" : "#4CAF50",
              padding: 10,
              borderRadius: 8,
              marginVertical: 10,
            }}
            onPress={() => recordingStatus === "recording" ? stopRecording() : startRecording()}
          >
            <Text style={{ color: "#FFF", textAlign: "center" }}>
              🎙 {recordingStatus === "recording" ? "Stop Recording" : "Record"}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message…"
          editable={!loading}
        />
        <Button title="Send" onPress={() => handleSend(inputText)} disabled={loading} />
      </View>
      <Toast />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f7" },
  msgContainer: {
    marginVertical: 4,
    maxWidth: "80%",
    alignSelf: "flex-start",
  },
  user: { alignSelf: "flex-end" },
  bot: { alignSelf: "flex-start" },
  userBubble: {
    backgroundColor: "#DCF8C6",
    borderRadius: 18,
    padding: 10,
    marginBottom: 4,
  },
  botBubble: {
    backgroundColor: "#e5e5ea",
    borderRadius: 18,
    padding: 10,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: "100%",
  },
  text: {
    color: "#000",
    fontSize: 16,
    lineHeight: 22,
  },
  ts: {
    fontSize: 10,
    color: "#555",
    textAlign: "right",
    marginTop: 4,
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderColor: "#ccc",
    borderWidth: 1,
    marginRight: 10,
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginLeft: 10,
  },
  typingText: {
    marginLeft: 8,
    color: "#555",
    fontStyle: "italic",
  },
  errBox: {
    backgroundColor: "#ffe0e0",
    padding: 10,
    margin: 10,
    borderRadius: 10,
  },
  errText: {
    color: "#a00",
    fontSize: 14,
  },
  voiceButton: {
    backgroundColor: "#6c5ce7",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
});
