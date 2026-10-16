# MyLedja_Frontend

Expo Go app for MyLedja.

```bash
npm install
npm run apptest
npm start
```

Scan the QR with Expo Go on Android or iOS.

`npm run apptest` is Test App: lint → typecheck → test → build.

## Running against the API

1. Start the backend (`MyLedja_Backend`, `npm run start:dev`). It listens on port 4000.
2. `EXPO_PUBLIC_API_URL=http://localhost:4000` in `.env.development` works on a phone too. In development the app swaps `localhost` for the address of the machine Expo is serving from. The phone and the PC must be on the same Wi-Fi, and Windows Firewall must allow Node on port 4000.
3. Sign-up codes are printed in the backend console (`[auth] verify code for …`) until an email provider is set up.

## Sessions

- The refresh token is stored only in iOS Keychain / Android Keystore (`expo-secure-store`, this device only, readable only while unlocked). The access token stays in memory.
- The web build keeps tokens in memory only, so reloading the page signs you out.
- Signing out revokes the server session, clears the stored token and remounts everything under the tabs, so the next user sees nothing from the last one.
