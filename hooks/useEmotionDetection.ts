// hooks/useEmotionDetection.ts
import { useEffect, useRef, useState } from "react";
import { Camera, CameraType } from "expo-camera";
import { manipulateAsync } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

export const useEmotionDetection = (
  isActive: boolean,
  onEmotionDetected: (emotion: string) => void
) => {
  const cameraRef = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const detectEmotion = async () => {
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            skipProcessing: true,
          });
          const resized = await manipulateAsync(
            photo.uri,
            [{ resize: { width: 300 } }],
            {
              compress: 0.7,
              format: "jpeg",
              base64: true,
            }
          );

          const response = await fetch(
            "https://<your-region>.api.cognitive.microsoft.com/face/v1.0/detect?returnFaceAttributes=emotion",
            {
              method: "POST",
              headers: {
                "Ocp-Apim-Subscription-Key": "<YOUR_SUBSCRIPTION_KEY>",
                "Content-Type": "application/octet-stream",
              },
              body: await FileSystem.readAsStringAsync(resized.uri, {
                encoding: FileSystem.EncodingType.Base64,
              }).then((base64) => Buffer.from(base64, "base64")),
            }
          );

          const json = await response.json();
          const emotions = json?.[0]?.faceAttributes?.emotion;

          if (emotions) {
            const detected = Object.entries(emotions).sort(
              (a, b) => b[1] - a[1]
            )[0][0];
            onEmotionDetected(detected);
          }
        } catch (err) {
          console.warn("Emotion detection error:", err);
        }
      }
    };

    if (hasPermission && isActive) {
      interval = setInterval(() => {
        detectEmotion();
      }, 5000); // every 5 seconds
    }

    return () => clearInterval(interval);
  }, [hasPermission, isActive]);

  return { cameraRef, hasPermission };
};
