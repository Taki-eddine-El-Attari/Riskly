import bcrypt
from fastapi import Depends , HTTPException ,Request , status, Response
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User


def hash_password(mot_de_passe: str) -> str:
    hashed= bcrypt.hashpw(mot_de_passe.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")

def verify_password(mot_de_passe: str, mot_de_passe_hash: str) -> bool:
    return bcrypt.checkpw(mot_de_passe.encode("utf-8"), mot_de_passe_hash.encode("utf-8"))

def set_auth_cookie(request: Request, user_id: str)-> None :
 request.session["user_id"] = str(user_id)

def  clear_auth_cookie(request: Request) -> None: 
   request.session.pop("user_id", None)
 
async def get_current_user(
        request : Request,
        db: Session = Depends(get_db)
)-> User:
 user_id=request.session.get("user_id")

 if user_id is None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Non authentifié",
    )
 user = db.query(User).filter(User.id == user_id).first()
 if user is None :
    raise HTTPException(
       status_code=status.HTTP_401_UNAUTHORIZED,
       detail="Utulisateur non trouvé" 
    )
 return user

def require_role(*allowed_roles : str):
   def role_checker(current_user : User = Depends(get_current_user))-> User:
      if current_user.role not in allowed_roles :
         raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail=f"Role requis : {','.join(allowed_roles)}"
         )
      return current_user
   return role_checker

require_admin=require_role("admin","superadmin")
require_superadmin= require_role("superadmin")
require_autheticated=require_role("user","admin","superadmin")

    