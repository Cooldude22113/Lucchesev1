# chroma_client.py
import chromadb
from chromadb.utils import embedding_functions
import os
from dotenv import load_dotenv
load_dotenv()

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8001))
CHROMA_HOST = "localhost"
CHROMA_PORT = 8001
EMBED_MODEL = "nomic-ai/nomic-embed-text-v1"

_client = None
_ef = None

def get_client() -> chromadb.HttpClient:
    global _client
    if _client is None:
        _client = chromadb.HttpClient(
            host=CHROMA_HOST,
            port=CHROMA_PORT,
        )
    return _client

def get_ef():
    global _ef
    if _ef is None:
        _ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBED_MODEL,
            trust_remote_code=True,
        )
    return _ef

def get_collection(name: str):
    return get_client().get_or_create_collection(
        name=name,
        embedding_function=get_ef(),
    )