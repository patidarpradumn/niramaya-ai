import firebase_admin
from firebase_admin import credentials
from app.core.config import settings

import os

def initialize_firebase():
    """Initialize Firebase Admin SDK."""
    if not firebase_admin._apps:
        cred_path = settings.FIREBASE_CREDENTIALS_PATH
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, options={'projectId': settings.FIREBASE_PROJECT_ID})
        else:
            # Try to use application default credentials if path not provided/found
            try:
                firebase_admin.initialize_app(options={'projectId': settings.FIREBASE_PROJECT_ID})
            except ValueError:
                print("WARNING: Firebase Admin credentials are not configured. End-to-end auth will fail.")
                raise RuntimeError("Firebase Admin credentials are not configured.")

initialize_firebase()
