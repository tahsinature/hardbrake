from rich import traceback

import file
import prompts
import handbrake
import manager


traceback.install()


hb = handbrake.Instance()
categories = hb.get_presets()


category = prompts.multi_select(choices=list(categories.keys()))
presets = categories[category]
preset = prompts.multi_select(choices=presets)


# files = file.select_files()
# files = ['/Users/tahsin/Desktop/hb-play/sample-5s.mp4', '/Users/tahsin/Desktop/hb-play/sample-10s.mp4',
#          '/Users/tahsin/Desktop/hb-play/sample-15s.mp4', '/Users/tahsin/Desktop/hb-play/sample-20s.mp4', '/Users/tahsin/Desktop/hb-play/sample-30s.mp4']

files = file.select_files()
cmds = [handbrake.get_cmd(file_path, preset) for file_path in files]
manager.manage(cmds)


# for file_path in files:
#     hb.encode(file_path, preset)

# hb.encode(files[-1], "Android 480p30")
