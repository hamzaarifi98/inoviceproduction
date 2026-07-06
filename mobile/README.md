# Invoice Pocket Mobile

React Native/Expo mobile frontend for Android camera upload.

## Run

Install dependencies:

```bash
cd mobile
npm install
```

Start Expo:

```bash
npm start
```

For a real phone on the same Wi-Fi network, prefer LAN mode:

```bash
npm run start:lan
```

For Android emulator:

```bash
npm run android
```

The default API URL is `http://10.0.2.2:8000`, which works for the Android emulator when the backend runs on your computer.

For a real phone with Expo Go, set the API URL on the login screen to your computer LAN IP, for example:

```text
http://192.168.1.20:8000
```

Your phone and computer must be on the same Wi-Fi network.

## Tunnel notes

`npm run start:tunnel` uses Expo's shared ngrok tunnel. If it fails with `Cannot read properties of undefined (reading 'body')`, `remote gone away`, or `ERR_NGROK_108`, the app is usually not the problem. It means Expo/ngrok could not allocate a tunnel session.

Use `npm run start:lan` when your phone and computer are on the same Wi-Fi network.

If you need a tunnel from a different network, use your own tunnel and point Expo at it:

```bash
ngrok http 8081
EXPO_PACKAGER_PROXY_URL=https://your-ngrok-url.ngrok-free.app npm run start:localhost
```
