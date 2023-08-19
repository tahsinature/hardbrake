import subprocess
import os
import tempfile
import src.prompts as prompts

output_path = os.path.join(tempfile.gettempdir(), "OUTFILE")
cmd = f"ranger --choosefiles={output_path}"


def select_files() -> list[str]:
  completed_process = subprocess.run(cmd, shell=True)
  if completed_process.returncode != 0:
    raise Exception("Something went wrong while selecting files")

  allowed_extensions = ["mp4", "mkv", "avi", "mov", "m4v", "flv", "wmv"]

  if not os.path.exists(output_path):
    return []

  with open(output_path, "r") as f:
    data = f.read()
    filtered_data = map(lambda x: x.strip(), data.splitlines())
    filtered_data = list(filter(lambda x: len(x) > 0, filtered_data))
    filtered_data = list(filter(lambda x: x.split(
        ".")[-1].lower() in allowed_extensions, filtered_data))

  os.remove(output_path)

  return filtered_data


class _Manager:
  files: list[str] = []
  original_files: list[str] = []

  def add_file(self, file_path: str) -> None:
    """Add a file to the list that has been interacted with"""
    self.files.append(file_path)

  def add_original_file(self, file_path: str) -> None:
    """Add original files to the list that has been interacted with"""
    self.original_files.append(file_path)

  def delete_file(self):
    # """Delete files from the list that has been interacted with"""
    delete_original_files = prompts.ask_boolean("Do you want to delete the original files?")
    if delete_original_files:
      for file_to_delete in self.original_files:
        os.remove(file_to_delete)
        print(f"Deleted {file_to_delete}")


manager = _Manager()
