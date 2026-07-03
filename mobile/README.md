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
