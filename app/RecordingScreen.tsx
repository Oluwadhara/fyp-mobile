import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig'; // adjust based on your setup
import Toast from 'react-native-toast-message'; // If you use react-native-toast-message

const ASSEMBLY_API_KEY = '1508c41adf824af680f5e97397907cd4'; // Replace with your actual key

export default function RecordingScreen() {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [transcription, setTranscription] = useState('');
    const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'saving'>('idle');
    const [inputText, setInputText] = useState(''); const [emotion, setEmotion] = useState<string | null>(null);

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
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setRecordingStatus("saving");
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            if (!uri) return;

            const fileName = uri.split("/").pop()!;
            const blob = await (await fetch(uri)).blob();

            const storageRef = ref(storage, `audio/${fileName}`);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            console.log("🎧 Audio uploaded, URL:", downloadURL);
            transcribeAudio(downloadURL);
        } catch (err) {
            console.error("🎤 Error stopping or uploading recording:", err);
        }
        setRecordingStatus("idle");
    };

    const transcribeAudio = async (audioUrl: string) => {
        try {
            const res = await axios.post(
                "https://api.assemblyai.com/v2/transcript",
                {
                    audio_url: audioUrl,
                    sentiment_analysis: true, // 🔍 Enable emotion detection
                },
                {
                    headers: {
                        authorization: ASSEMBLY_API_KEY,
                        "content-type": "application/json",
                    },
                }
            );

            const transcriptId = res.data.id;

            const poll = async () => {
                const statusRes = await axios.get(
                    `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                    {
                        headers: {
                            authorization: ASSEMBLY_API_KEY,
                        },
                    }
                );

                if (statusRes.data.status === "completed") {
                    const transcript = statusRes.data.text;
                    const sentiments = statusRes.data.sentiment_analysis_results;

                    setInputText(transcript);
                    console.log("✅ Transcription:", transcript);

                    if (sentiments && sentiments.length > 0) {
                        const topSentiment = sentiments[0].sentiment;
                        Toast.show({
                            type: 'success',
                            text1: `Transcription ready!`,
                            text2: `Emotion Detected: ${topSentiment}`,
                        });
                        setEmotion(topSentiment);
                    } else {
                        Toast.show({ type: 'success', text1: 'Transcription ready!' });
                    }
                } else if (statusRes.data.status === "failed") {
                    console.error("❌ Transcription failed:", statusRes.data.error);
                    Toast.show({ type: 'error', text1: 'Transcription failed' });
                } else {
                    setTimeout(poll, 2000);
                }
            };

            setTimeout(poll, 2000);
        } catch (e) {
            console.error("🧨 Error during transcription request:", e);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                onPress={recordingStatus === "recording" ? stopRecording : startRecording}
                style={{
                    backgroundColor: recordingStatus === "recording" ? "#ff5555" : "#4CAF50",
                    padding: 10,
                    borderRadius: 6,
                }}
            >
                <Text style={{ color: "#fff" }}>
                    {recordingStatus === "recording" ? "Stop" : "Record"}
                </Text>
            </TouchableOpacity>
            <Text style={styles.label}>Transcribed Text:</Text>
            <Text style={styles.transcription}>{inputText || 'No transcription yet'}</Text>
            {emotion && (
                <Text style={{ fontSize: 16, color: '#666', marginTop: 10 }}>
                    Emotion: {emotion}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 5,
    },
    transcription: {
        fontSize: 16,
        color: '#333',
        marginBottom: 10,
    },
});
