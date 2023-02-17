import hashlib


def hash(cmd: str) -> str:
  return hashlib.sha256(cmd.encode("utf-8")).hexdigest()[0:8]
