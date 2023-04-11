import src.logger as logger
import src.utils as utils
import src.manager as manager
import src.prompts as prompts
import src.file as file
from rich import traceback, print

traceback.install()


def main():
  try:
    try:
      utils.verify_installation("HandBrakeCLI")
      logger.success("HandBrakeCLI is installed")
    except Exception as e:
      logger.error(e.args[0])
      return

    happy = False
    original_files = file.select_files()

    if len(original_files) == 0:
      logger.error("No files selected")
      return

    for file_path in original_files:
      file.manager.add_file(file_path)

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
