import { Capacitor } from '@capacitor/core';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') return null;

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value);
      });
      PushNotifications.addListener('registrationError', () => {
        resolve(null);
      });
      setTimeout(() => resolve(null), 10000);
    });
  } catch {
    return null;
  }
}

export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!Capacitor.isNativePlatform()) return 'denied';

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.checkPermissions();
    return result.receive === 'granted' ? 'granted' : result.receive === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'denied';
  }
}
