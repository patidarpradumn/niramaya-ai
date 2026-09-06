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
            try:
                firebase_admin.initialize_app(options={'projectId': settings.FIREBASE_PROJECT_ID})
            except Exception as e:
                print(f"INFO: Firebase Admin initialized with project {settings.FIREBASE_PROJECT_ID} ({e})")

initialize_firebase()
