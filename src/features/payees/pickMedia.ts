import * as DocumentPicker from 'expo-document-picker';

/** Pick a photo/file for a payee logo or profile photo (PU-46, PU-63). */
export async function pickImageUri(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
