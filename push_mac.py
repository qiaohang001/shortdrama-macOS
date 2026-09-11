import subprocess, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
# git credential fill 取回缓存凭据
p = subprocess.run(["git", "credential", "fill"], input="protocol=https\nhost=github.com\n\n", capture_output=True, text=True, encoding="utf-8", errors="replace")
out = p.stdout
user = pw = None
for line in out.splitlines():
    if line.startswith("username="): user = line.split("=",1)[1]
    if line.startswith("password="): pw = line.split("=",1)[1]
print("user:", user, "| pw_found:", bool(pw), "| err:", p.stderr.strip()[:200])
if user and pw:
    url = f"https://{user}:{pw}@github.com/qiaohang001/shortdrama-macOS.git"
    r = subprocess.run(["git", "push", url, "main"], capture_output=True, text=True, encoding="utf-8", errors="replace", env={**os.environ, "GCM_INTERACTIVE":"never", "GIT_TERMINAL_PROMPT":"0"})
    print("push rc:", r.returncode)
    print((r.stdout + r.stderr)[-600:])
