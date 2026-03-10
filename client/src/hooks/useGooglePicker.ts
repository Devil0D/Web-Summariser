import { useEffect, useState } from "react";
import type {} from "google-one-tap";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

export function useGooglePicker() {
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(false);
  let tokenClient: any;

  useEffect(() => {
    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.onload = () => {
      (window as any).gapi.load("picker", () => setPickerApiLoaded(true));
    };
    document.body.appendChild(gapiScript);

    const gsiScript = document.createElement("script");
    gsiScript.src = "https://accounts.google.com/gsi/client";
    gsiScript.onload = () => setGsiLoaded(true);
    document.body.appendChild(gsiScript);
  }, []);

  const openPicker = (callback: (file: any) => void) => {
    if (!gsiLoaded || !pickerApiLoaded) {
      alert("Google API is not ready yet. Please try again in a moment.");
      return;
    }
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: { access_token: string }) => {
        if (tokenResponse.access_token) {
          createPicker(tokenResponse.access_token, callback);
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: "" });
  };

  const createPicker = (accessToken: string, callback: (file: any) => void) => {
    const google = (window as any).google;
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes(
      "image/png,image/jpeg,application/pdf,application/vnd.google-apps.document"
    );

    const picker = new google.picker.PickerBuilder()
      .setApiKey(GOOGLE_API_KEY)
      .setOAuthToken(accessToken)
      .addView(view)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const file = data.docs[0];
          console.log("Selected file from drive", file);
          callback(file);
        }
      })
      .build();

    picker.setVisible(true);
  };
  return { openPicker };
}
