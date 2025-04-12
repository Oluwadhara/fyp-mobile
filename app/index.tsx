import { View, Text, Button } from "react-native";
import { Link } from "expo-router";

export default function Home() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Welcome to MindEase 🧘</Text>
      <Link href="/ChatScreen">Go to Chat</Link>
    </View>
  );
}
