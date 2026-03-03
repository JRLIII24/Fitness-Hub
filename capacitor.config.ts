import type { CapacitorConfig } from "@capacitor/cli";

const isDevMode = process.env.CAPACITOR_ENV === "development";
const devServerUrl = process.env.CAPACITOR_DEV_URL ?? "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "com.fithub.app",
  appName: "FitHub",
  webDir: "public",

  server: isDevMode
    ? {
        url: devServerUrl,
        cleartext: true,
      }
    : {
        url: "https://fithub.vercel.app",
        cleartext: false,
        errorPath: "error.html",
      },

  ios: {
    contentInset: "always",
    backgroundColor: "#09090b",
    preferredContentMode: "mobile",
    scheme: "FitHub",
  },

  android: {
    backgroundColor: "#09090b",
    allowMixedContent: isDevMode,
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      androidSplashResourceName: "splash",
      backgroundColor: "#09090b",
      showSpinner: false,
      launchFadeOutDuration: 300,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notification",
      iconColor: "#09090b",
    },
  },
};

export default config;
