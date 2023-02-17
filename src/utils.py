import hashlib
import subprocess


def hash(cmd: str) -> str:
  return hashlib.sha256(cmd.encode("utf-8")).hexdigest()[0:8]


def get_encode_cmd(input_file_path: str, preset: str):
  file_name_without_extension = input_file_path.rsplit(".", 1)[0]
  output_file_path = f"{file_name_without_extension}_HandBraked-{preset}.mp4"
  cmd = f"HandBrakeCLI -i '{input_file_path}' -o '{output_file_path}' -Z '{preset}'"

  return cmd


def get_presets():
  cmd = "HandBrakeCLI -z"
  result = subprocess.run(cmd, shell=True, capture_output=True)
  output = result.stderr.decode("utf-8")

  lines = output.splitlines()
  preset_map: dict[str, list[str]] = {}

  category = ""

  for line in lines:
    num_of_space_in_the_beginning = len(line) - len(line.lstrip())
    is_category = "/" in line
    is_preset = num_of_space_in_the_beginning == 4

    if is_category:
      category = line.strip("/")
      preset_map[category] = []

    if len(category) > 0 and is_preset:
      preset_map[category].append(line.strip().strip("\t"))

  return preset_map


def verify_installation(program_name: str):
  cmd = f"which {program_name}"
  result = subprocess.run(cmd, shell=True, capture_output=True)
  output_text = result.stdout.decode("utf-8")
  stderr_text = result.stderr.decode("utf-8")

  if len(output_text) == 0 or len(stderr_text) > 0:
    raise Exception("HandBrakeCLI is not installed",
                    stderr_text or output_text or "No output")

  print("HandBrakeCLI is installed")
