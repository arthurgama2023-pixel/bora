import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

Future initFirebase() async {
  if (kIsWeb) {
    await Firebase.initializeApp(
        options: FirebaseOptions(
            apiKey: "AIzaSyAEN7KM8-oX2_KQPOAAQ02_n84KQeY5Vws",
            authDomain: "massion-gp8c0i.firebaseapp.com",
            projectId: "massion-gp8c0i",
            storageBucket: "massion-gp8c0i.firebasestorage.app",
            messagingSenderId: "33030354434",
            appId: "1:33030354434:web:9766b6c0bdd502cfad591b"));
  } else {
    await Firebase.initializeApp();
  }
}
