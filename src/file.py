import subprocess
import os
import tempfile


output_path = os.path.join(tempfile.gettempdir(), "OUTFILE")
cmd = f"ranger --choosefiles={output_path}"


def select_files():
  completed_process = subprocess.run(cmd, shell=True)
  if completed_process.returncode != 0:
    raise Exception("Something went wrong while selecting files")

  allowed_extensions = ["mp4", "mkv", "avi", "mov", "m4v", "flv", "wmv"]

  with open(output_path, "r") as f:
    data = f.read()
    filtered_data = map(lambda x: x.strip(), data.splitlines())
    filtered_data = list(filter(lambda x: len(x) > 0, filtered_data))
    filtered_data = list(filter(lambda x: x.split(
        ".")[-1] in allowed_extensions, filtered_data))

  os.remove(output_path)

  return filtered_data
