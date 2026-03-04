import { createClient } from '@/lib/supabase/server';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseApp: any = null;

async function getFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_JSON not configured — push notifications disabled');
    return null;
  }

  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const apps = getApps();
    if (apps.length > 0) {
      firebaseApp = apps[0];
    } else {
      firebaseApp = initializeApp({
        credential: cert(JSON.parse(serviceAccount)),
      });
    }
    return firebaseApp;
  } catch (e) {
    console.error('Failed to initialize Firebase Admin:', e);
    return null;
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const admin = await getFirebaseAdmin();
  if (!admin) return 0;

  const supabase = await createClient();
  const { data: tokens } = await supabase
    .from('push_device_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) return 0;

  const { getMessaging } = await import('firebase-admin/messaging');
  const messaging = getMessaging(admin);

  let sent = 0;
  for (const { token } of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
      sent++;
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        await supabase.from('push_device_tokens').delete().eq('token', token);
      }
    }
  }

  return sent;
}
