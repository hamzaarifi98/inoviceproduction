import AsyncStorage from "@react-native-async-storage/async-storage";

export async function readJson(key, fallback) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  return AsyncStorage.setItem(key, JSON.stringify(value));
}
