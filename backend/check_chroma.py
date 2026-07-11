# save as check_chroma.py and run it
from chroma_client import get_client

client = get_client()

try:
    print("Heartbeat:", client.heartbeat())
    cols = client.list_collections()
    print(f"Collections ({len(cols)}):")
    for c in cols:
        col = client.get_collection(c.name)
        print(f"  {c.name}: {col.count()} entries")
except Exception as e:
    print(f"Error: {e}")