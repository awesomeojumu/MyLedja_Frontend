import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

type Picked = { uri: string } | null;

/**
 * Pick a photo/file for a payee logo (PU-46).
 * Native: photo library or camera when expo-image-picker is available; else document picker.
 * Web: file picker (drag-and-drop is handled on the logo target).
 */
export async function pickImageUri(opts?: { camera?: boolean }): Promise<string | null> {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const fromPicker = await tryImagePicker(opts?.camera === true);
    if (fromPicker !== undefined) return fromPicker;
  }
  return pickDocument();
}

async function tryImagePicker(camera: boolean): Promise<string | null | undefined> {
  try {
    // Optional peer: present when the app ships with expo-image-picker.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImagePicker = require('expo-image-picker') as {
      requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
      requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
      launchCameraAsync: (o: object) => Promise<{ canceled: boolean; assets?: { uri: string }[] }>;
      launchImageLibraryAsync: (o: object) => Promise<{ canceled: boolean; assets?: { uri: string }[] }>;
    };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return null;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled) return null;
      return result.assets?.[0]?.uri ?? null;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return null;
    return result.assets?.[0]?.uri ?? null;
  } catch {
    return undefined;
  }
}

async function pickDocument(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/** Read a dropped File (web) into a data URL for the logo. */
export function readDroppedImage(file: File): Promise<Picked> {
  if (!file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const uri = typeof reader.result === 'string' ? reader.result : null;
      resolve(uri ? { uri } : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
