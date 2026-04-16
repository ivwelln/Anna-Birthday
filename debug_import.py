import faulthandler

faulthandler.dump_traceback_later(3, repeat=False)

print("before-import", flush=True)
from app.main import app
print(app.title, flush=True)
