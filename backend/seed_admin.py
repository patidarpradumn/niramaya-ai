import os
import sys
from getpass import getpass

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from firebase_admin import auth, exceptions
from app.core.firebase import initialize_firebase
from app.db.session import SessionLocal
from app.models import User, UserRoleEnum

def seed_admin():
    print("=== Niramaya AI Super Admin Bootstrap ===")
    
    email = input("Admin Email: ").strip()
    full_name = input("Admin Full Name: ").strip()
    password = getpass("Admin Password (for Firebase): ")
    
    # Init Firebase
    try:
        initialize_firebase()
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        return

    # Create or get user in Firebase
    firebase_uid = None
    try:
        user_record = auth.get_user_by_email(email)
        print(f"User already exists in Firebase with UID: {user_record.uid}")
        firebase_uid = user_record.uid
        
        # Optionally update password if needed
        # auth.update_user(user_record.uid, password=password)
    except exceptions.NotFoundError:
        print("Creating user in Firebase...")
        user_record = auth.create_user(
            email=email,
            password=password,
            display_name=full_name
        )
        firebase_uid = user_record.uid
        print(f"Successfully created new Firebase user with UID: {firebase_uid}")
    
    # Set custom claims for role
    print(f"Setting custom claim role=SUPER_ADMIN for Firebase user {firebase_uid}")
    auth.set_custom_user_claims(firebase_uid, {'role': 'super_admin'})
    
    # Save to PostgreSQL
    print("Saving to PostgreSQL application database...")
    db: Session = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print("User already exists in PostgreSQL.")
            if existing_user.firebase_uid != firebase_uid:
                print(f"Updating firebase_uid from {existing_user.firebase_uid} to {firebase_uid}")
                existing_user.firebase_uid = firebase_uid
            
            if existing_user.role != UserRoleEnum.SUPER_ADMIN:
                print("Updating user role to SUPER_ADMIN")
                existing_user.role = UserRoleEnum.SUPER_ADMIN
                
            db.commit()
            print("Successfully updated PostgreSQL user.")
        else:
            new_user = User(
                email=email,
                firebase_uid=firebase_uid,
                full_name=full_name,
                role=UserRoleEnum.SUPER_ADMIN,
                is_active=True
            )
            db.add(new_user)
            db.commit()
            print("Successfully created PostgreSQL user.")
    except Exception as e:
        db.rollback()
        print(f"Error saving to database: {e}")
    finally:
        db.close()

    print("=== Bootstrap Complete ===")

if __name__ == "__main__":
    seed_admin()
