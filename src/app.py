from rich import traceback, print

import src.file as file
import src.prompts as prompts
import src.manager as manager
import src.utils as utils
import src.logger as logger

traceback.install()


# files = file.select_files()
# files = ['/Users/tahsin/Desktop/hb-play/sample-5s.mp4', '/Users/tahsin/Desktop/hb-play/sample-10s.mp4',
#          '/Users/tahsin/Desktop/hb-play/sample-15s.mp4', '/Users/tahsin/Desktop/hb-play/sample-20s.mp4', '/Users/tahsin/Desktop/hb-play/sample-30s.mp4']

def cli():

  try:
    try:
      utils.verify_installation("HandBrakeCLI")
      logger.success("HandBrakeCLI is installed")
    except Exception as e:
      logger.error(e.args[0])
      return

    categories = utils.get_presets()
    category = prompts.multi_select(choices=list(categories.keys()))
    presets = categories[category]
    preset = prompts.multi_select(choices=presets)

    files = file.select_files()
    cmds = [utils.get_encode_cmd(file_path, preset) for file_path in files]
    manager.manage(cmds)
  except KeyboardInterrupt:
    print("Exiting...")
