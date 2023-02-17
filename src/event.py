import subprocess
from pyee.base import EventEmitter
from typing import Callable, Any
import re


class ProcessWithEvent():
  lines: list[str] = []
  current_line: str = ""

  def __init__(self, cmd: str,
               filter: Callable[[str], Any] = lambda x: x,
               progress_cb: Callable[[str, int], None] = lambda x, y: None):
    self.cmd = cmd
    self.filter = filter
    self.ee = EventEmitter()
    self.progress_cb = progress_cb

  def start(self):
    self.process = subprocess.Popen(self.cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, executable="/bin/zsh")
    self.ee.emit("start")

    while True:
      if not self.process.poll() is None or self.process.stdout is None:
        if len(self.current_line) > 0:
          self.handle_new_line()
        self.progress_cb(self.cmd, 100)
        break

      last = self.process.stdout.read(1)

      if last == b"\n" or last == b"\r":
        self.handle_new_line()
      else:
        self.current_line += last.decode("utf-8")

  def handle_new_line(self):
    self.lines.append(self.current_line)
    exp = r"(\d+\.\d+)(?=\s%)"
    match = re.search(exp, self.current_line)
    if match is not None:
      self.progress_cb(self.cmd, int(float(match.group(1))))

    elif match is None:
      # loader.loader.progress.log(self.current_line)
      pass

    self.current_line = ""
