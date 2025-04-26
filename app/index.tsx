import { View, Text, Button } from "react-native";
import { Link } from "expo-router";
import Toast from 'react-native-toast-message';

export default function Home() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Welcome to MindEase 🧘</Text>
      <Link href="/ChatScreen">Go to Chat</Link>
      <Link href="/RecordingScreen">Go to Recording Screen</Link>
      <Toast />
    </View>
  );
}
