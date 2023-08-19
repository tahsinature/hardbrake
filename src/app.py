from rich import traceback, print
import requests
import os

from src import VERSION
import src.logger as logger
import src.utils as utils
import src.manager as manager
import src.prompts as prompts
import src.file as file

traceback.install()


def main():
  try:
    try:
      utils.verify_installation("HandBrakeCLI")
      logger.success("HandBrakeCLI found")
      utils.verify_installation("ranger")
      logger.success("ranger found")
    except Exception as e:
      logger.error(e.args[0])
      return

    happy = False
    original_files = file.select_files()

    if len(original_files) == 0:
      logger.error("No files selected")
      return

    for file_path in original_files:
      file.manager.add_original_file(file_path)

    while not happy:
      preset = utils.select_preset()

      cmds = [utils.get_encode_cmd(file_path, preset) for file_path in original_files]
      manager.manage(cmds)

      happy = prompts.ask_boolean("Are you happy with the results?")

    file.manager.delete_file()
    logger.success("Job done!")

  except KeyboardInterrupt:
    print("Exiting...")


def test():
  print("testing...")

  # file.manager.add_file('/Users/tahsin/Desktop/demvid/a.txt')
  # file.manager.add_file('/Users/tahsin/Desktop/demvid/b.txt')
  # file.manager.add_file('/Users/tahsin/Desktop/demvid/c.txt')
  # file.manager.add_file('/Users/tahsin/Desktop/demvid/foo.txt')

  # file.manager.delete_file()
  # pass
  # print('here')


def has_update(old_version, new_version):
  old_version = old_version.split(".")
  new_version = new_version.split(".")

  for i in range(len(old_version)):
    if int(old_version[i]) < int(new_version[i]):
      return True

  return False


def update():
  package_name = "hardbrake"
  url = f"https://pypi.org/pypi/{package_name}/json"
  response = requests.get(url)
  data = response.json()
  latest_version = data["info"]["version"]
  current_version = VERSION

  if has_update(current_version, latest_version):
    logger.print(f"New version of {package_name} available: {latest_version}")
    answer = prompts.ask_boolean(f"Do you want to update? ({current_version} -> {latest_version})")

    if answer:
      cmd = f"pip install --upgrade {package_name}"
      os.system(cmd)
  else:
    logger.success(f"You are using the latest version of {package_name} ({current_version})")
