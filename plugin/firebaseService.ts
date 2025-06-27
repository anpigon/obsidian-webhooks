import { FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  User,
  Unsubscribe as AuthUnsubscribe,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  onValue,
  goOffline,
  goOnline,
  DataSnapshot,
  Unsubscribe as DbUnsubscribe,
} from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "shared/firebase"; // Assuming shared/firebase.ts exports the initialized Firebase app

export interface FirebaseServiceHooks {
  onAuthStateChanged: (user: User | null) => void;
  onBufferChange: (data: DataSnapshot) => Promise<void>;
}

export class FirebaseService {
  private firebaseApp: FirebaseApp;
  private authUnsubscribe?: AuthUnsubscribe;
  private valUnsubscribe?: DbUnsubscribe;
  private hooks: FirebaseServiceHooks;
  private database = getDatabase(app); // Keep a reference to the database

  constructor(hooks: FirebaseServiceHooks) {
    this.firebaseApp = app;
    this.hooks = hooks;
  }

  public initializeAuthListener(): void {
    if (this.authUnsubscribe) {
      this.authUnsubscribe(); // Unsubscribe from any previous listener
    }
    this.authUnsubscribe = onAuthStateChanged(
      getAuth(this.firebaseApp),
      (user) => {
        this.hooks.onAuthStateChanged(user);
        if (user) {
          this.initializeBufferListener(user.uid);
        } else {
          this.cleanupBufferListener();
        }
      }
    );
  }

  private initializeBufferListener(userId: string): void {
    if (this.valUnsubscribe) {
      this.valUnsubscribe(); // Unsubscribe from any previous listener
    }
    const bufferRef = ref(this.database, `buffer/${userId}`);
    this.valUnsubscribe = onValue(bufferRef, async (data) => {
      try {
        await goOffline(this.database); // Go offline before processing
        await this.hooks.onBufferChange(data);
      } finally {
        await goOnline(this.database); // Go back online after processing
      }
    });
  }

  public async wipeData(value: unknown): Promise<void> {
    const functions = getFunctions(this.firebaseApp);
    const wipeCallable = httpsCallable(functions, "wipe");
    await wipeCallable(value);
  }

  public cleanupListeners(): void {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = undefined;
    }
    this.cleanupBufferListener();
  }

  private cleanupBufferListener(): void {
    if (this.valUnsubscribe) {
      this.valUnsubscribe();
      this.valUnsubscribe = undefined;
    }
  }
}
