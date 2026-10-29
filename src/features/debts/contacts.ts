import { Platform } from 'react-native';

/**
 * P15-05 / DESIGN Page 15: contacts picker on iOS/Android only.
 * Web types the person name. Permission is asked the first time; denial falls back to typing.
 */
export function contactsAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export type PickedContact = { name: string };

type ContactsModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  presentContactPickerAsync?: () => Promise<{
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
  } | null>;
};

function loadContacts(): ContactsModule | null {
  try {
    // require so Jest mocks apply (dynamic import can bypass the mock factory).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-contacts') as ContactsModule;
  } catch {
    return null;
  }
}

export async function pickContact(): Promise<PickedContact | null> {
  if (!contactsAvailable()) return null;
  const Contacts = loadContacts();
  if (!Contacts) return null;
  try {
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) return null;
    if (typeof Contacts.presentContactPickerAsync !== 'function') return null;
    const contact = await Contacts.presentContactPickerAsync();
    if (!contact) return null;
    const name =
      [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.name?.trim() || '';
    return name ? { name } : null;
  } catch {
    return null;
  }
}
