from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from API.analytics_api import router as analytics_router
from API.voice_endpoint import router as voice_router

app = FastAPI(title="MILPÍN AgTech v2.0 API")

# Crucial para que el frontend pueda comunicarse con el backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de microservicios
app.include_router(analytics_router, prefix="/api")
app.include_router(voice_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)