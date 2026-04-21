from fastapi import APIRouter, UploadFile, File
import shutil
import os
from core.llm_orchestrator import interpretar_comando_voz

router = APIRouter()

@router.post("/voice-command")
async def receive_voice(audio_file: UploadFile = File(...)):
    temp_path = f"temp_{audio_file.filename}"
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)
    
    # Procesar y obtener el comando JSON
    resultado = interpretar_comando_voz(temp_path)
    
    # Limpieza
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    return resultado